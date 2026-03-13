'use client';

import { SunIcon, MoonIcon, CheckCircleIcon } from '@heroicons/react/20/solid';

type WeekSummaryStripProps = {
  totalDayShifts: number;
  totalNightShifts: number;
  fullShifts: number;
  incompleteShifts: number;
};

export function WeekSummaryStrip({
  totalDayShifts,
  totalNightShifts,
  fullShifts,
  incompleteShifts,
}: WeekSummaryStripProps) {
  const total = totalDayShifts + totalNightShifts;
  const progress = total > 0 ? Math.round((fullShifts / total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-2 dark:border-zinc-700/80 dark:bg-zinc-900/50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <SunIcon
            className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400"
            aria-hidden
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            יום: <span className="tabular-nums">{totalDayShifts}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MoonIcon
            className="h-4 w-4 text-indigo-500 dark:text-indigo-400"
            aria-hidden
          />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            לילה: <span className="tabular-nums">{totalNightShifts}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 border-s border-zinc-200 ps-4 dark:border-zinc-700">
        <div className="flex items-center gap-1">
          <CheckCircleIcon
            className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400"
            aria-hidden
          />
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            מלאים:{' '}
            <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
              {fullShifts}
            </span>
          </span>
        </div>
        {incompleteShifts > 0 && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            חסרים:{' '}
            <span className="font-semibold tabular-nums">
              {incompleteShifts}
            </span>
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="flex min-w-[80px] items-center gap-1.5 border-s border-zinc-200 ps-4 dark:border-zinc-700">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 dark:bg-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-500 tabular-nums dark:text-zinc-400">
            {progress}%
          </span>
        </div>
      )}
    </div>
  );
}
