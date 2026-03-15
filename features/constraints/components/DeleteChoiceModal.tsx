'use client';

import type { Constraint } from '@/lib/utils/interfaces';
import { ShiftType } from '@/lib/utils/enums';
import { formatDateHe } from '@/features/constraints/utils';

type Props = {
  constraint: Constraint;
  deleting: boolean;
  onDeleteSingle: () => void;
  onDeleteSeries: () => void;
  onCancel: () => void;
};

export function DeleteChoiceModal({
  constraint,
  deleting,
  onDeleteSingle,
  onDeleteSeries,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-choice-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200/80 bg-white p-5 shadow-xl dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <h2
          id="delete-choice-title"
          className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50"
        >
          למחוק אילוץ?
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {formatDateHe(constraint.date)} ·{' '}
          {constraint.type === ShiftType.Day
            ? 'משמרת יום'
            : 'משמרת לילה'}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onDeleteSingle}
            disabled={deleting}
            className="cursor-pointer rounded-xl border border-zinc-200/80 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            מחיקה חד-פעמית (רק תאריך זה)
          </button>
          <button
            type="button"
            onClick={onDeleteSeries}
            disabled={deleting}
            className="cursor-pointer rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
          >
            מחיקת כל המחזור
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
