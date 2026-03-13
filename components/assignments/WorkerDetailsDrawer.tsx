'use client';

import type {
  Assignment,
  Constraint,
  Shift,
  Worker,
} from '@/lib/utils/interfaces';
import { ConstraintStatus, ShiftType } from '@/lib/utils/enums';
import { DrawerShell } from './DrawerShell';

type WorkerDetailsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker | null;
  workersById: Record<string, Worker>;
  shiftsById: Record<string, Shift>;
  assignmentsInWeek: Assignment[];
  constraintsInWeek: Constraint[];
  getWorkerDisplayName: (w: Worker | undefined) => string;
  getWorkerInitials: (w: Worker | undefined) => string;
  getWorkerAvatarColor: (workerId: string, worker?: Worker) => string;
  formatDateHe: (date: string) => string;
  getDayName: (date: string) => string;
};

export function WorkerDetailsDrawer({
  isOpen,
  onClose,
  worker,
  workersById,
  shiftsById,
  assignmentsInWeek,
  constraintsInWeek,
  getWorkerDisplayName,
  getWorkerInitials,
  getWorkerAvatarColor,
  formatDateHe,
  getDayName,
}: WorkerDetailsDrawerProps) {
  if (!worker) return null;

  const workerAssignments = assignmentsInWeek.filter(
    (a) => a.worker_id === worker.id
  );
  const totalShifts = workerAssignments.length;
  const dayCount = workerAssignments.filter((a) => {
    const s = shiftsById[a.shift_id];
    return s?.type === ShiftType.Day || s?.type === ShiftType.FullDay;
  }).length;
  const nightCount = workerAssignments.filter((a) => {
    const s = shiftsById[a.shift_id];
    return s?.type === ShiftType.Night;
  }).length;

  const workerConstraints = constraintsInWeek.filter(
    (c) => c.worker_id === worker.id
  );
  const hasConflicts = workerConstraints.some(
    (c) => c.status === ConstraintStatus.Unavailable
  );
  const workloadStatus =
    totalShifts >= 5
      ? 'high'
      : totalShifts >= 3
        ? 'balanced'
        : totalShifts > 0
          ? 'low'
          : 'none';

  const title = getWorkerDisplayName(worker);

  return (
    <DrawerShell isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${getWorkerAvatarColor(worker.id, worker)}`}
          >
            {getWorkerInitials(worker)}
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {getWorkerDisplayName(worker)}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalShifts} משמרות השבוע
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              משמרות יום
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {dayCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              משמרות לילה
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {nightCount}
            </p>
          </div>
        </div>

        {(hasConflicts || workloadStatus === 'high') && (
          <div className="space-y-1.5">
            {hasConflicts && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                ⚠️ קיימים אילוצים השבוע
              </span>
            )}
            {workloadStatus === 'high' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                עומס גבוה
              </span>
            )}
            {workloadStatus === 'balanced' && !hasConflicts && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                עומס מאוזן
              </span>
            )}
          </div>
        )}

        {workerConstraints.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
              אילוצים השבוע
            </h3>
            <ul className="space-y-1.5">
              {workerConstraints.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {formatDateHe(c.date)} ·{' '}
                    {c.type === 'full_day'
                      ? 'כל היום'
                      : c.type === 'day'
                        ? 'יום'
                        : 'לילה'}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      c.status === 'unavailable'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    {c.status === ConstraintStatus.Unavailable
                      ? 'לא זמין'
                      : 'חלקי'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
            שיבוצים השבוע
          </h3>
          {workerAssignments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              אין שיבוצים השבוע
            </p>
          ) : (
            <ul className="space-y-1.5">
              {workerAssignments.map((a) => {
                const s = shiftsById[a.shift_id];
                const typeLabel = s
                  ? s.type === 'full_day'
                    ? 'כל היום'
                    : s.type === 'day'
                      ? 'יום'
                      : 'לילה'
                  : '—';
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {s ? formatDateHe(s.date) : '—'} · {typeLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}
