'use client';

import type { ReactNode } from 'react';

export type ShiftStatus = 'full' | 'partial' | 'empty' | 'none';

const statusStyles: Record<
  ShiftStatus,
  { bg: string; text: string; badge?: string }
> = {
  full: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  partial: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  },
  empty: {
    bg: 'bg-zinc-100 dark:bg-zinc-800/80',
    text: 'text-zinc-500 dark:text-zinc-400',
    badge: 'bg-zinc-200/80 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
  },
  none: {
    bg: 'bg-zinc-50 dark:bg-zinc-800/50',
    text: 'text-zinc-400 dark:text-zinc-500',
    badge: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
  },
};

type ShiftBlockProps = {
  icon: ReactNode;
  status: ShiftStatus;
  content: ReactNode;
  statusLabel?: string;
};

export function ShiftBlock({
  icon,
  status,
  content,
  statusLabel,
}: ShiftBlockProps) {
  const styles = statusStyles[status];
  const badgeText =
    statusLabel ??
    (status === 'full'
      ? 'מלא'
      : status === 'partial'
        ? 'חלקי'
        : status === 'empty'
          ? 'ריק'
          : '—');

  return (
    <div
      className={`hover:border-opacity-80 flex min-h-[36px] flex-col justify-center rounded-lg border px-2 py-1.5 transition-all duration-200 hover:shadow-sm ${
        status === 'full'
          ? 'border-emerald-500/30 dark:border-emerald-500/25'
          : status === 'partial'
            ? 'border-amber-500/30 dark:border-amber-500/25'
            : 'border-zinc-200/60 dark:border-zinc-700/60'
      } ${styles.bg}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <span className="mt-0.5 shrink-0 opacity-70 [&>svg]:h-3 [&>svg]:w-3">
            {icon}
          </span>
          <span
            className={`min-w-0 text-xs font-medium break-words ${styles.text}`}
          >
            {content}
          </span>
        </div>
        {status !== 'none' && (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${styles.badge}`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
