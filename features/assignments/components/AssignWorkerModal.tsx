'use client';

import Dropdown from '@/components/Dropdown';
import type { Worker } from '@/lib/utils/interfaces';
import type { AssigningCell } from '@/features/assignments/types';
import { ShiftType } from '@/lib/utils/enums';
import {
  formatDateHe,
  workerDisplayName,
} from '@/features/assignments/utils';

type Props = {
  assigningCell: AssigningCell;
  workersSorted: Worker[];
  assignmentCountByWorkerThisWeek: Record<string, number>;
  onSelect: (date: string, type: ShiftType, workerId: string) => void;
  onClose: () => void;
};

export function AssignWorkerModal({
  assigningCell,
  workersSorted,
  assignmentCountByWorkerThisWeek,
  onSelect,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-sm flex-col rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2">
          <Dropdown
            placeholder="בחירת כונן…"
            value=""
            onSelect={(workerId) => {
              if (!workerId) return;
              onSelect(assigningCell.date, assigningCell.type, workerId);
            }}
            items={[
              { value: '', label: 'בחירת כונן…' },
              ...workersSorted.map((w) => {
                const count =
                  assignmentCountByWorkerThisWeek[w.id] ?? 0;
                const suffix =
                  count > 0 ? ` · ${count} שיבוצים השבוע` : '';
                return {
                  value: w.id,
                  label: `${workerDisplayName(w)}${suffix}`,
                };
              }),
            ]}
          />
        </div>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          שיבוץ ל־{formatDateHe(assigningCell.date)} –{' '}
          {assigningCell.type === 'full_day'
            ? 'כל היום'
            : assigningCell.type === 'day'
              ? 'יום'
              : 'לילה'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full cursor-pointer rounded-xl border border-zinc-300 py-2 text-sm dark:border-zinc-700"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
