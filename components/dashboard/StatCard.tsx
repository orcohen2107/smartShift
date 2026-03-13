'use client';

import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBgClass?: string;
};

export function StatCard({
  label,
  value,
  icon,
  iconBgClass = 'bg-emerald-100 dark:bg-emerald-500/20',
}: StatCardProps) {
  return (
    <div className="group rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:hover:border-zinc-600">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBgClass} transition-transform duration-200 group-hover:scale-105`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="text-lg font-bold text-zinc-900 tabular-nums dark:text-zinc-50">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
