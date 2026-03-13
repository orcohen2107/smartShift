'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  SunIcon,
  MoonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/20/solid';
import { useAssignments } from '@/contexts/AssignmentsContext';
import { useProfile } from '@/contexts/ProfileContext';
import Dropdown from '@/components/Dropdown';
import type { Shift, Worker } from '@/lib/utils/interfaces';
import { canManage, ShiftType } from '@/lib/utils/enums';

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function getWeekDates(offset: number): string[] {
  const out: string[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const start = new Date(today);
  // offset חיובי = שבועות קדימה, שלילי = שבועות אחורה
  start.setDate(today.getDate() - dayOfWeek + offset * 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

export default function DashboardPage() {
  const {
    overview,
    loading,
    error,
    load,
    selectedBoardId,
    setSelectedBoardId,
    hasCachedData,
  } = useAssignments();
  const profile = useProfile();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(
    () => (mounted ? getWeekDates(weekOffset) : []),
    [mounted, weekOffset]
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const canManageShifts = profile && canManage(profile.role);

  useEffect(() => {
    if (hasCachedData || profile === null) return;
    void load();
  }, [hasCachedData, profile, load]);

  // סינון משמרות לפי לוח נבחר – כולם יכולים לעבור בין הלוחות
  const shiftsFiltered = useMemo(() => {
    const shifts = overview?.shifts ?? [];
    if (!selectedBoardId) return shifts;
    return shifts.filter((s) => s.board_id === selectedBoardId);
  }, [overview?.shifts, selectedBoardId]);

  const shiftsByDateType = useMemo(() => {
    const map: Record<string, { day?: Shift; night?: Shift }> = {};
    shiftsFiltered.forEach((s) => {
      if (!map[s.date]) map[s.date] = {};
      map[s.date][s.type as 'day' | 'night'] = s;
    });
    return map;
  }, [shiftsFiltered]);

  const stats = useMemo(() => {
    const shifts = shiftsFiltered;
    const assignments = overview?.assignments ?? [];
    // worker_id – אם מנהל בחר עובד: העובד הנבחר. אחרת: המשתמש המחובר
    const targetWorkerId =
      selectedWorkerId ??
      (profile
        ? overview?.workers?.find(
            (w) => w.user_id === profile.id || w.id === profile.id
          )?.id
        : null);
    const myAssignments =
      targetWorkerId != null
        ? assignments.filter((a) => a.worker_id === targetWorkerId)
        : [];
    const assignmentsCount = myAssignments.length;
    let dayCount = 0;
    let nightCount = 0;
    myAssignments.forEach((a) => {
      const shift = shifts.find((s) => s.id === a.shift_id);
      if (shift?.type === ShiftType.Day) dayCount += 1;
      if (shift?.type === ShiftType.Night) nightCount += 1;
    });
    const byDay: Record<string, { day: number; night: number }> = {};
    weekDates.forEach((d) => {
      const dayShift = shifts.find(
        (s) => s.date === d && s.type === ShiftType.Day
      );
      const nightShift = shifts.find(
        (s) => s.date === d && s.type === ShiftType.Night
      );
      byDay[d] = {
        day: dayShift
          ? (assignments.filter((a) => a.shift_id === dayShift.id).length ?? 0)
          : 0,
        night: nightShift
          ? (assignments.filter((a) => a.shift_id === nightShift.id).length ??
            0)
          : 0,
      };
    });
    return { dayCount, nightCount, assignmentsCount, targetWorkerId, byDay };
  }, [overview, weekDates, profile, selectedWorkerId, shiftsFiltered]);

  const workersById = useMemo(() => {
    const map: Record<string, Worker> = {};
    overview?.workers.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [overview]);

  /** כוננים לא-מילואים לפי א-ב, ואז מילואים לפי א-ב */
  const workersSorted = useMemo(() => {
    const list: Worker[] = [...(overview?.workers ?? [])];
    const name = (w: Worker) => (w.full_name ?? w.email ?? w.id ?? '').trim();
    return list.sort((a, b) => {
      if (a.is_reserves !== b.is_reserves) return a.is_reserves ? 1 : -1;
      return name(a).localeCompare(name(b), 'he');
    });
  }, [overview?.workers]);

  const workerDisplayName = (w: Partial<Worker> | undefined) =>
    w
      ? `${w.full_name ?? w.email ?? w.id ?? '—'}${w.is_reserves ? ' (מילואים)' : ''}`
      : '—';

  const getAssignmentsForShift = useCallback(
    (shiftId: string) =>
      overview?.assignments.filter((a) => a.shift_id === shiftId) ?? [],
    [overview?.assignments]
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            טוען דאשבורד...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      </div>
    );
  }

  const boards = overview?.boards ?? [];

  const weekLabel =
    weekOffset === 0
      ? 'השבוע'
      : weekOffset === 1
        ? 'שבוע הבא'
        : weekOffset === -1
          ? 'שבוע קודם'
          : weekOffset > 0
            ? `עוד ${weekOffset === 2 ? 'שבועיים' : `${weekOffset} שבועות`}`
            : `לפני ${
                Math.abs(weekOffset) === 2
                  ? 'שבועיים'
                  : `${Math.abs(weekOffset)} שבועות`
              }`;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            דאשבורד
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            סקירה וסטטיסטיקות כלליות, עם פירוט שבועי מטה.
          </p>
          <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v - 1)}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label="שבוע קודם"
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden />
            </button>
            <span className="min-w-[100px] px-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {weekLabel}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v + 1)}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label="שבוע הבא"
            >
              <ChevronLeftIcon className="h-5 w-5" aria-hidden />
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="mr-2 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
              >
                חזרה להיום
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-row flex-nowrap items-end gap-3 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0 md:overflow-visible">
          {boards.length > 0 && (
            <div className="flex w-44 flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                לוח שיבוצים
              </label>
              <Dropdown
                placeholder="כל הלוחות"
                value={selectedBoardId ?? ''}
                onSelect={(id) => setSelectedBoardId(id || null)}
                items={[
                  { value: '', label: 'כל הלוחות' },
                  ...boards.map((b) => ({
                    value: b.id,
                    label: `${b.name}${b.workers_per_shift > 1 ? ` (${b.workers_per_shift} במשמרת)` : ' (אדם יחיד)'}`,
                  })),
                ]}
              />
            </div>
          )}
          {canManageShifts &&
            overview?.workers &&
            overview.workers.length > 0 && (
              <div className="flex w-44 flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  צפייה בסיכום שיבוצים של
                </label>
                <Dropdown
                  placeholder="אני (המשתמש המחובר)"
                  value={selectedWorkerId ?? ''}
                  onSelect={(id) => setSelectedWorkerId(id || null)}
                  items={[
                    { value: '', label: 'אני (המשתמש המחובר)' },
                    ...workersSorted
                      .filter(
                        (w) => w.user_id !== profile?.id && w.id !== profile?.id
                      )
                      .map((w) => ({
                        value: w.id,
                        label: `${workerDisplayName(w)}${!w.user_id ? ' (טרם נרשם)' : ''}`,
                      })),
                  ]}
                />
              </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-500/20">
              <SunIcon
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
            </div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              משמרות יום
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {stats.dayCount}
          </p>
        </div>
        <div className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-500/20">
              <MoonIcon
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                aria-hidden
              />
            </div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              משמרות לילה
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {stats.nightCount}
          </p>
        </div>
        <div className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-500/20">
              <ChartBarIcon
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
            </div>
            <p
              className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400"
              title={
                stats.targetWorkerId
                  ? `שיבוצים של ${workerDisplayName(workersById[stats.targetWorkerId])}`
                  : 'השיבוצים שלי'
              }
            >
              {stats.targetWorkerId
                ? `שיבוצים של ${workerDisplayName(workersById[stats.targetWorkerId])}`
                : 'השיבוצים שלי'}
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900 tabular-nums sm:text-3xl dark:text-zinc-50">
            {stats.assignmentsCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="border-b border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/80">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">
            <CalendarDaysIcon
              className="h-5 w-5 text-zinc-500 dark:text-zinc-400"
              aria-hidden
            />
            שיבוצים לפי יום – השבוע
          </h2>
        </div>
        <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-3 text-right text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  יום
                </th>
                <th className="p-3 text-right text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  תאריך
                </th>
                <th className="p-3 text-right text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <SunIcon className="h-4 w-4" aria-hidden />
                    משמרת יום
                  </span>
                </th>
                <th className="p-3 text-right text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <MoonIcon className="h-4 w-4" aria-hidden />
                    משמרת לילה
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {weekDates.map((date) => {
                const dayShift = shiftsByDateType[date]?.day;
                const nightShift = shiftsByDateType[date]?.night;
                const assignDay = dayShift
                  ? getAssignmentsForShift(dayShift.id)
                  : [];
                const assignNight = nightShift
                  ? getAssignmentsForShift(nightShift.id)
                  : [];
                const [y, m, d] = date.split('-');
                const dayName =
                  DAY_NAMES_HE[
                    new Date(Number(y), Number(m) - 1, Number(d)).getDay()
                  ];
                const dayCount = dayShift?.required_count ?? 1;
                const nightCount = nightShift?.required_count ?? 1;
                const dayFull = assignDay.length >= dayCount;
                const nightFull = assignNight.length >= nightCount;
                const dayEmpty = assignDay.length === 0;
                const nightEmpty = assignNight.length === 0;
                return (
                  <tr
                    key={date}
                    className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <td className="p-3 text-zinc-500 dark:text-zinc-400">
                      {dayName}
                    </td>
                    <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDateHe(date)}
                    </td>
                    <td className="p-3">
                      <div
                        className={`rounded-lg px-2.5 py-1.5 text-xs ${
                          dayFull
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : dayEmpty
                              ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        }`}
                      >
                        {assignDay.length > 0 ? (
                          <span>
                            {assignDay
                              .map((a) =>
                                workerDisplayName(workersById[a.worker_id])
                              )
                              .join(', ')}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div
                        className={`rounded-lg px-2.5 py-1.5 text-xs ${
                          nightFull
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : nightEmpty
                              ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        }`}
                      >
                        {assignNight.length > 0 ? (
                          <span>
                            {assignNight
                              .map((a) =>
                                workerDisplayName(workersById[a.worker_id])
                              )
                              .join(', ')}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/constraints"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 shadow-sm transition-all duration-200 hover:bg-emerald-400 hover:shadow-md"
        >
          <CalendarIcon className="h-4 w-4" aria-hidden />
          אילוצים
        </Link>
        {canManageShifts && (
          <Link
            href="/assignments"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ClipboardDocumentListIcon className="h-4 w-4" aria-hidden />
            שיבוצים
          </Link>
        )}
      </div>
    </div>
  );
}
