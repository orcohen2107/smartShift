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
import { StatCard } from '@/components/dashboard/StatCard';
import { type ShiftStatus } from '@/components/dashboard/ShiftBlock';
import { WeekRow } from '@/components/dashboard/WeekRow';
import { WeekSummaryStrip } from '@/components/dashboard/WeekSummaryStrip';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
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

function isToday(dateStr: string): boolean {
  const today = new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return (
    today.getFullYear() === y &&
    today.getMonth() === m - 1 &&
    today.getDate() === d
  );
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

  const weekSummary = useMemo(() => {
    const shifts = shiftsFiltered;
    const assignments = overview?.assignments ?? [];
    let totalDay = 0;
    let totalNight = 0;
    let full = 0;
    let incomplete = 0;
    weekDates.forEach((d) => {
      const dayShift = shifts.find(
        (s) => s.date === d && s.type === ShiftType.Day
      );
      const nightShift = shifts.find(
        (s) => s.date === d && s.type === ShiftType.Night
      );
      const dayCount = dayShift?.required_count ?? 1;
      const nightCount = nightShift?.required_count ?? 1;
      const dayAssign = dayShift
        ? assignments.filter((a) => a.shift_id === dayShift.id).length
        : 0;
      const nightAssign = nightShift
        ? assignments.filter((a) => a.shift_id === nightShift.id).length
        : 0;
      if (dayShift) {
        totalDay += 1;
        if (dayAssign >= dayCount) full += 1;
        else if (dayAssign > 0) incomplete += 1;
      }
      if (nightShift) {
        totalNight += 1;
        if (nightAssign >= nightCount) full += 1;
        else if (nightAssign > 0) incomplete += 1;
      }
    });
    return { totalDay, totalNight, full, incomplete };
  }, [shiftsFiltered, overview?.assignments, weekDates]);

  const workersById = useMemo(() => {
    const map: Record<string, Worker> = {};
    overview?.workers?.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [overview]);

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

  function getShiftStatus(assignCount: number, required: number): ShiftStatus {
    if (required === 0) return 'none';
    if (assignCount >= required) return 'full';
    if (assignCount > 0) return 'partial';
    return 'empty';
  }

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
    <div className="animate-fade-in space-y-4">
      <header className="space-y-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            דאשבורד
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            סקירה וסטטיסטיקות כלליות, עם פירוט שבועי מטה.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-zinc-200/80 bg-white p-0.5 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/60">
              <button
                type="button"
                onClick={() => setWeekOffset((v) => v - 1)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="שבוע קודם"
              >
                <ChevronRightIcon className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-[90px] px-2 text-center text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {weekLabel}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((v) => v + 1)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="שבוע הבא"
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
              >
                חזרה להיום
              </button>
            )}
          </div>
          <div className="flex flex-row flex-nowrap items-end gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0 md:overflow-visible">
            {boards.length > 0 && (
              <div className="flex w-36 flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  לוח שיבוצים
                </label>
                <Dropdown
                  placeholder="כל הלוחות"
                  value={selectedBoardId ?? ''}
                  onSelect={(id) => setSelectedBoardId(id || null)}
                  buttonClassName="inline-flex w-full min-h-[36px] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
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
                <div className="flex w-36 flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    צפייה בסיכום שיבוצים של
                  </label>
                  <Dropdown
                    placeholder="אני (המשתמש המחובר)"
                    value={selectedWorkerId ?? ''}
                    onSelect={(id) => setSelectedWorkerId(id || null)}
                    buttonClassName="inline-flex w-full min-h-[36px] items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    items={[
                      { value: '', label: 'אני (המשתמש המחובר)' },
                      ...workersSorted
                        .filter(
                          (w) =>
                            w.user_id !== profile?.id && w.id !== profile?.id
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
      </header>

      <section className="grid grid-cols-3 gap-2">
        <StatCard
          label="משמרות יום"
          value={stats.dayCount}
          icon={
            <SunIcon
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
          }
          iconBgClass="bg-amber-100 dark:bg-amber-500/20"
        />
        <StatCard
          label="משמרות לילה"
          value={stats.nightCount}
          icon={
            <MoonIcon
              className="h-4 w-4 text-indigo-600 dark:text-indigo-400"
              aria-hidden
            />
          }
          iconBgClass="bg-indigo-100 dark:bg-indigo-500/20"
        />
        <StatCard
          label={
            stats.targetWorkerId
              ? `שיבוצים של ${workerDisplayName(workersById[stats.targetWorkerId])}`
              : 'השיבוצים שלי'
          }
          value={stats.assignmentsCount}
          icon={
            <ChartBarIcon
              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          }
        />
      </section>

      <section className="space-y-2">
        <SectionHeader
          icon={<CalendarDaysIcon className="h-4 w-4" aria-hidden />}
          title="לוח שיבוצים שבועי"
        />

        <WeekSummaryStrip
          totalDayShifts={weekSummary.totalDay}
          totalNightShifts={weekSummary.totalNight}
          fullShifts={weekSummary.full}
          incompleteShifts={weekSummary.incomplete}
        />

        <div className="space-y-0 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/60">
          <div className="grid min-w-[280px] grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-2 border-b border-zinc-200/80 px-3 py-1.5 dark:border-zinc-700/80">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              יום / תאריך
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              <SunIcon
                className="h-4 w-4 text-amber-500 dark:text-amber-400"
                aria-hidden
              />
              משמרת יום
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              <MoonIcon
                className="h-4 w-4 text-indigo-500 dark:text-indigo-400"
                aria-hidden
              />
              משמרת לילה
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
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
              const dayRequired = dayShift?.required_count ?? 1;
              const nightRequired = nightShift?.required_count ?? 1;
              const dayStatus = dayShift
                ? getShiftStatus(assignDay.length, dayRequired)
                : 'none';
              const nightStatus = nightShift
                ? getShiftStatus(assignNight.length, nightRequired)
                : 'none';
              const dayContent =
                assignDay.length > 0 ? (
                  <span className="flex flex-col gap-0.5">
                    {assignDay.map((a) => (
                      <span key={a.id}>
                        {workerDisplayName(workersById[a.worker_id])}
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                );
              const nightContent =
                assignNight.length > 0 ? (
                  <span className="flex flex-col gap-0.5">
                    {assignNight.map((a) => (
                      <span key={a.id}>
                        {workerDisplayName(workersById[a.worker_id])}
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                );

              return (
                <WeekRow
                  key={date}
                  dayName={dayName}
                  dateFormatted={formatDateHe(date)}
                  isToday={isToday(date)}
                  dayShiftContent={dayContent}
                  dayShiftStatus={dayStatus}
                  nightShiftContent={nightContent}
                  nightShiftStatus={nightStatus}
                />
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/constraints"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 shadow-sm transition-all duration-200 hover:bg-emerald-400 hover:shadow-md"
        >
          <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
          אילוצים
        </Link>
        {canManageShifts && (
          <Link
            href="/assignments"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ClipboardDocumentListIcon className="h-3.5 w-3.5" aria-hidden />
            שיבוצים
          </Link>
        )}
      </div>
    </div>
  );
}
