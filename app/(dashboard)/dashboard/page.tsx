"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAssignments } from "@/contexts/AssignmentsContext";
import { useProfile } from "@/contexts/ProfileContext";
import type { Shift } from "@/lib/utils/interfaces";
import { Role, ShiftType } from "@/lib/utils/enums";

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function getCurrentWeekDates(): string[] {
  const out: string[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

export default function DashboardPage() {
  const { overview, loading, error, load, selectedBoardId, setSelectedBoardId } = useAssignments();
  const profile = useProfile();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const isManager = profile?.role === Role.Manager;

  useEffect(() => {
    if (!overview) void load();
  }, []);

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
      map[s.date][s.type as "day" | "night"] = s;
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
        ? overview?.workers?.find((w) => w.user_id === profile.id || w.id === profile.id)?.id
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
      const dayShift = shifts.find((s) => s.date === d && s.type === ShiftType.Day);
      const nightShift = shifts.find((s) => s.date === d && s.type === ShiftType.Night);
      byDay[d] = {
        day: dayShift ? (assignments.filter((a) => a.shift_id === dayShift.id).length ?? 0) : 0,
        night: nightShift ? (assignments.filter((a) => a.shift_id === nightShift.id).length ?? 0) : 0,
      };
    });
    return { dayCount, nightCount, assignmentsCount, targetWorkerId, byDay };
  }, [overview, weekDates, profile, selectedWorkerId, shiftsFiltered]);

  const workersById = useMemo(() => {
    const map: Record<string, { full_name: string | null }> = {};
    overview?.workers.forEach((w) => {
      map[w.id] = { full_name: w.full_name };
    });
    return map;
  }, [overview]);

  const getAssignmentsForShift = useCallback(
    (shiftId: string) =>
      overview?.assignments.filter((a) => a.shift_id === shiftId) ?? [],
    [overview?.assignments],
  );

  const handleBoardChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setSelectedBoardId(e.target.value || null),
    [setSelectedBoardId],
  );
  const handleWorkerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setSelectedWorkerId(e.target.value || null),
    [],
  );

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">טוען דשבורד...</p>
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
      <div className="flex flex-row flex-wrap items-end gap-2 sm:gap-3 sm:justify-between">
        <div className="min-w-0 shrink-0">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            דשבורד
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            סקירה וסטטיסטיקות לשבוע הנוכחי
          </p>
        </div>
        <div className="flex flex-row flex-nowrap items-end gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:gap-3 sm:pb-0">
          {boards.length > 0 && (
            <div className="flex flex-col items-center space-y-1">
              <label className="block text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
                לוח שיבוצים
              </label>
              <select
                value={selectedBoardId ?? ""}
                onChange={handleBoardChange}
                className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
              >
                <option value="">כל הלוחות</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.workers_per_shift > 1 ? ` (${b.workers_per_shift} במשמרת)` : " (אדם יחיד)"}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isManager && overview?.workers && overview.workers.length > 0 && (
          <div className="flex flex-col items-center space-y-1">
            <label className="block text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
              צפייה בסיכום שיבוצים של
            </label>
            <select
              value={selectedWorkerId ?? ""}
              onChange={handleWorkerChange}
              className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            >
              <option value="">אני (המשתמש המחובר)</option>
              {overview.workers
                .filter((w) => w.user_id !== profile?.id && w.id !== profile?.id)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name ?? w.email ?? w.id}
                    {!w.user_id ? " (טרם נרשם)" : ""}
                  </option>
                ))}
            </select>
          </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:rounded-2xl sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-xs">משמרות יום</p>
          <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-zinc-50 sm:mt-1 sm:text-2xl">
            {stats.dayCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:rounded-2xl sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-xs">משמרות לילה</p>
          <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-zinc-50 sm:mt-1 sm:text-2xl">
            {stats.nightCount}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:rounded-2xl sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-xs" title={stats.targetWorkerId ? `שיבוצים של ${workersById[stats.targetWorkerId]?.full_name ?? "נבחר"}` : "השיבוצים שלי"}>
            {stats.targetWorkerId
              ? `שיבוצים של ${workersById[stats.targetWorkerId]?.full_name ?? "נבחר"}`
              : "השיבוצים שלי"}
          </p>
          <p className="mt-0.5 text-lg font-bold text-zinc-900 dark:text-zinc-50 sm:mt-1 sm:text-2xl">
            {stats.assignmentsCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          שיבוצים לפי יום – השבוע
        </h2>
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">יום</th>
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">תאריך</th>
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">משמרת יום</th>
                <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">משמרת לילה</th>
              </tr>
            </thead>
            <tbody>
              {weekDates.map((date) => {
                const dayShift = shiftsByDateType[date]?.day;
                const nightShift = shiftsByDateType[date]?.night;
                const assignDay = dayShift ? getAssignmentsForShift(dayShift.id) : [];
                const assignNight = nightShift ? getAssignmentsForShift(nightShift.id) : [];
                const [y, m, d] = date.split("-");
                const dayName = DAY_NAMES_HE[new Date(Number(y), Number(m) - 1, Number(d)).getDay()];
                return (
                  <tr key={date} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="p-2 text-zinc-500 dark:text-zinc-400">{dayName}</td>
                    <td className="p-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDateHe(date)}
                    </td>
                    <td className="p-2">
                      {assignDay.length > 0 ? (
                        <span className="text-xs">
                          {assignDay.map((a) => workersById[a.worker_id]?.full_name ?? "—").join(", ")}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      {assignNight.length > 0 ? (
                        <span className="text-xs">
                          {assignNight.map((a) => workersById[a.worker_id]?.full_name ?? "—").join(", ")}
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
        {isManager && (
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
