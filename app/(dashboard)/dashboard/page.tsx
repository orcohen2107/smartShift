'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            טוען דשבורד...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const boards = overview?.boards ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-row flex-wrap items-end gap-2 sm:justify-between sm:gap-3">
        <div className="min-w-0 shrink-0 space-y-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            דשבורד
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            סקירה וסטטיסטיקות כלליות, עם פירוט שבועי מטה.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200">
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v - 1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label="שבוע קודם"
            >
              ‹
            </button>
            <span className="whitespace-nowrap">
              {weekOffset === 0
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
                        }`}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v + 1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label="שבוע הבא"
            >
              ›
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="ml-1 cursor-pointer text-[11px] text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                חזרה להיום
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-row flex-nowrap items-end gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:gap-3 sm:pb-0 md:overflow-visible">
          {boards.length > 0 && (
            <div className="flex w-40 flex-col items-center space-y-1">
              <label className="block text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
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
              <div className="flex w-40 flex-col items-center space-y-1">
                <label className="block text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
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

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:rounded-2xl sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-medium text-zinc-500 sm:text-xs dark:text-zinc-400">
            משמרות יום
          </p>
          <p className="mt-0.5 text-lg font-bold text-zinc-900 sm:mt-1 sm:text-2xl dark:text-zinc-50">
            {stats.dayCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:rounded-2xl sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-medium text-zinc-500 sm:text-xs dark:text-zinc-400">
            משמרות לילה
          </p>
          <p className="mt-0.5 text-lg font-bold text-zinc-900 sm:mt-1 sm:text-2xl dark:text-zinc-50">
            {stats.nightCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:rounded-2xl sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p
            className="truncate text-[10px] font-medium text-zinc-500 sm:text-xs dark:text-zinc-400"
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
          <p className="mt-0.5 text-lg font-bold text-zinc-900 sm:mt-1 sm:text-2xl dark:text-zinc-50">
            {stats.assignmentsCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          שיבוצים לפי יום – השבוע
        </h2>
        <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">
                  יום
                </th>
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">
                  תאריך
                </th>
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">
                  משמרת יום
                </th>
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">
                  משמרת לילה
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
                return (
                  <tr
                    key={date}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="p-2 text-zinc-500 dark:text-zinc-400">
                      {dayName}
                    </td>
                    <td className="p-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDateHe(date)}
                    </td>
                    <td className="p-2">
                      {assignDay.length > 0 ? (
                        <span className="text-xs">
                          {assignDay
                            .map((a) =>
                              workerDisplayName(workersById[a.worker_id])
                            )
                            .join(', ')}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {assignNight.length > 0 ? (
                        <span className="text-xs">
                          {assignNight
                            .map((a) =>
                              workerDisplayName(workersById[a.worker_id])
                            )
                            .join(', ')}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/constraints"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
        >
          אילוצים
        </Link>
        {canManageShifts && (
          <Link
            href="/assignments"
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            שיבוצים
          </Link>
        )}
      </div>
    </div>
  );
}
