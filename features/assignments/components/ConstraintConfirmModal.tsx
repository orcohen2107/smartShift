'use client';

import { useState } from 'react';
import type { PendingConstraintConfirm } from '@/features/assignments/types';

type Props = {
  pending: PendingConstraintConfirm;
  onConfirm: (shiftId: string, workerId: string) => Promise<void>;
  onCancel: () => void;
};

export function ConstraintConfirmModal({
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
      <div className="my-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-base font-semibold text-zinc-800 dark:text-zinc-200">
          אילוץ בתאריך
        </h3>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          ל־{pending.workerName} יש אילוץ באותו יום. אתה בטוח שאתה רוצה לשבץ
          אותו?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm(pending.shiftId, pending.workerId);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'טוען…' : 'כן, לשבץ'}
          </button>
        </div>
      </div>
    </div>
  );
}
