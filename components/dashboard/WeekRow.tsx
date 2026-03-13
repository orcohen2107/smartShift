'use client';

import { SunIcon, MoonIcon } from '@heroicons/react/20/solid';
import type { ShiftStatus } from './ShiftBlock';
import { ShiftBlock } from './ShiftBlock';

type WeekRowProps = {
  dayName: string;
  dateFormatted: string;
  isToday: boolean;
  dayShiftContent: React.ReactNode;
  dayShiftStatus: ShiftStatus;
  nightShiftContent: React.ReactNode;
  nightShiftStatus: ShiftStatus;
};

export function WeekRow({
  dayName,
  dateFormatted,
  isToday,
  dayShiftContent,
  dayShiftStatus,
  nightShiftContent,
  nightShiftStatus,
}: WeekRowProps) {
  return (
    <div
      className={`group grid grid-cols-[1fr_1.2fr_1.2fr] gap-2 rounded-lg px-3 py-1.5 transition-all duration-200 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 ${
        isToday
          ? 'bg-emerald-500/5 ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 dark:ring-emerald-500/15'
          : ''
      }`}
    >
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {dayName}
          </span>
          {isToday && (
            <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
              היום
            </span>
          )}
        </div>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {dateFormatted}
        </span>
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-2">
        <ShiftBlock
          icon={
            <SunIcon
              className="h-4 w-4 text-amber-500 dark:text-amber-400"
              aria-hidden
            />
          }
          status={dayShiftStatus}
          content={dayShiftContent}
        />
        <ShiftBlock
          icon={
            <MoonIcon
              className="h-4 w-4 text-indigo-500 dark:text-indigo-400"
              aria-hidden
            />
          }
          status={nightShiftStatus}
          content={nightShiftContent}
        />
      </div>
    </div>
  );
}
