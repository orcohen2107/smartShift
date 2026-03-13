'use client';

import { TrashIcon } from '@heroicons/react/20/solid';
import type { Assignment, Shift, Worker } from '@/lib/utils/interfaces';
import { ShiftType } from '@/lib/utils/enums';
import { DrawerShell } from './DrawerShell';

type ShiftDetailsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
  date: string;
  cellType: ShiftType;
  assigns: Assignment[];
  workersById: Record<string, Worker>;
  workersSorted: Worker[];
  getWorkerDisplayName: (w: Worker | undefined) => string;
  getWorkerInitials: (w: Worker | undefined) => string;
  getWorkerAvatarColor: (workerId: string, worker?: Worker) => string;
  hasConstraintForShift: (
    workerId: string,
    date: string,
    shiftType: ShiftType
  ) => boolean;
  formatDateHe: (date: string) => string;
  getDayName: (date: string) => string;
  canEdit: boolean;
  onUnassign: (assignmentId: string) => void;
  onAddWorker: (shift: Shift, workerId: string) => void;
  onOpenAssignModal?: (date: string, cellType: ShiftType) => void;
  unassigningId: string | null;
};

export function ShiftDetailsDrawer({
  isOpen,
  onClose,
  shift,
  date,
  cellType,
  assigns,
  workersById,
  workersSorted,
  getWorkerDisplayName,
  getWorkerInitials,
  getWorkerAvatarColor,
  hasConstraintForShift,
  formatDateHe,
  getDayName,
  canEdit,
  onUnassign,
  onAddWorker,
  onOpenAssignModal,
  unassigningId,
}: ShiftDetailsDrawerProps) {
  if (!shift && !date) return null;

  const required = shift?.required_count ?? 1;
  const current = assigns.length;
  const missing = Math.max(0, required - current);
  const status: 'full' | 'missing' | 'empty' =
    current >= required ? 'full' : current > 0 ? 'missing' : 'empty';

  const assignedWorkerIds = new Set(assigns.map((a) => a.worker_id));
  const candidateWorkers = workersSorted.filter(
    (w) => !assignedWorkerIds.has(w.id)
  );

  const shiftTypeLabel =
    cellType === ShiftType.FullDay
      ? 'כל היום'
      : cellType === ShiftType.Day
        ? 'משמרת יום'
        : 'משמרת לילה';

  const title = shift
    ? `${formatDateHe(date)} · ${shiftTypeLabel}`
    : `${formatDateHe(date)} · ${shiftTypeLabel}`;

  return (
    <DrawerShell isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {getDayName(date)}
          </span>
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
              status === 'full'
                ? 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300'
                : status === 'missing'
                  ? 'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300'
                  : 'bg-red-500/20 text-red-700 dark:bg-red-500/25 dark:text-red-300'
            }`}
          >
            {status === 'full'
              ? 'מלא'
              : status === 'missing'
                ? 'חסר כונן'
                : 'ריק'}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            נדרשים {required} כוננים · שובצו {current}
            {missing > 0 && (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {' '}
                · חסרים {missing}
              </span>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
            שובצו למשמרת
          </h3>
          {assigns.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              עדיין אין כוננים שובצו
            </p>
          ) : (
            <ul className="space-y-2">
              {assigns.map((a) => {
                const w = workersById[a.worker_id];
                const hasConstraint = hasConstraintForShift(
                  a.worker_id,
                  date,
                  cellType
                );
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getWorkerAvatarColor(a.worker_id, w)}`}
                      >
                        {getWorkerInitials(w)}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {getWorkerDisplayName(w)}
                      </span>
                      {hasConstraint && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          קונפליקט
                        </span>
                      )}
                    </div>
                    {canEdit && shift && (
                      <button
                        type="button"
                        onClick={() => onUnassign(a.id)}
                        disabled={unassigningId === a.id}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        {unassigningId === a.id ? 'מסיר…' : 'הסר'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canEdit && !shift && onOpenAssignModal && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAssignModal(date, cellType);
            }}
            className="w-full cursor-pointer rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
          >
            + שבץ כונן (יצירת משמרת)
          </button>
        )}

        {canEdit && shift && candidateWorkers.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
              הוסף כונן
            </h3>
            <ul className="space-y-1">
              {candidateWorkers.slice(0, 8).map((w) => {
                const hasConstraint = hasConstraintForShift(
                  w.id,
                  date,
                  cellType
                );
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => onAddWorker(shift, w.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getWorkerAvatarColor(w.id, w)}`}
                      >
                        {getWorkerInitials(w)}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {getWorkerDisplayName(w)}
                      </span>
                      {hasConstraint && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                          אילוץ
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {candidateWorkers.length > 8 && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                ועוד {candidateWorkers.length - 8} כוננים
              </p>
            )}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}
