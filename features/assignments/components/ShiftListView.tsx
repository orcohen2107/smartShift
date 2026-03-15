'use client';

import { TrashIcon } from '@heroicons/react/20/solid';
import Dropdown from '@/components/Dropdown';
import type {
  Assignment,
  Constraint,
  Shift,
  Worker,
} from '@/lib/utils/interfaces';
import { ConstraintStatus, ShiftType } from '@/lib/utils/enums';
import type { ShiftDrawerState } from '@/features/assignments/types';
import {
  formatDateHe,
  workerDisplayName,
  getWorkerInitials,
  getWorkerAvatarColor,
} from '@/features/assignments/utils';

type Props = {
  shifts: Shift[];
  workersById: Record<string, Worker>;
  workersSorted: Worker[];
  assignmentCountByWorkerThisWeek: Record<string, number>;
  constraintsByWorkerDateType: Record<string, Constraint[]>;
  getAssignmentsForShift: (shiftId: string) => Assignment[];
  hasConstraintForShift: (
    workerId: string,
    date: string,
    shiftType: ShiftType
  ) => boolean;
  onUnassign: (assignmentId: string) => void;
  onAssign: (shift: Shift, workerId: string) => void;
  onOpenShiftDrawer: (state: ShiftDrawerState) => void;
  onOpenWorkerDrawer: (worker: Worker) => void;
  unassigningId: string | null;
  error: string | null;
};

function hasUnavailableConstraint(
  constraints: Record<string, Constraint[]>,
  profileId: string | null,
  date: string,
  shiftType: ShiftType
) {
  if (!profileId) return false;
  const key = `${profileId}-${date}-${shiftType}`;
  return (constraints[key] ?? []).some(
    (c) => c.status === ConstraintStatus.Unavailable
  );
}

export function ShiftListView({
  shifts,
  workersById,
  workersSorted,
  assignmentCountByWorkerThisWeek,
  constraintsByWorkerDateType,
  getAssignmentsForShift,
  hasConstraintForShift,
  onUnassign,
  onAssign,
  onOpenShiftDrawer,
  onOpenWorkerDrawer,
  unassigningId,
  error,
}: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        משמרות (יום + לילה)
      </h2>
      {shifts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          אין משמרות מוגדרות.
        </p>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => {
            const shiftAssignments = getAssignmentsForShift(shift.id);
            const cellType =
              shift.type === 'full_day'
                ? ShiftType.FullDay
                : shift.type === 'day'
                  ? ShiftType.Day
                  : ShiftType.Night;
            return (
              <div
                key={shift.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onOpenShiftDrawer({
                    date: shift.date,
                    cellType,
                    shift,
                    assigns: shiftAssignments,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenShiftDrawer({
                      date: shift.date,
                      cellType,
                      shift,
                      assigns: shiftAssignments,
                    });
                  }
                }}
                className="cursor-pointer space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDateHe(shift.date)} ·{' '}
                      {shift.type === 'full_day'
                        ? 'כל היום'
                        : shift.type === 'day'
                          ? 'יום'
                          : 'לילה'}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {shiftAssignments.length} כוננים שובצו למשמרת זו
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      שובצו למשמרת
                    </div>
                    {shiftAssignments.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        עדיין אין כוננים שובצו למשמרת זו.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {shiftAssignments.map((a) => {
                          const worker = workersById[a.worker_id];
                          const hasConstraint = hasConstraintForShift(
                            a.worker_id,
                            shift.date,
                            shift.type
                          );
                          const unavailable = hasUnavailableConstraint(
                            constraintsByWorkerDateType,
                            worker?.user_id ?? null,
                            shift.date,
                            shift.type
                          );
                          return (
                            <li
                              key={a.id}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (worker) onOpenWorkerDrawer(worker);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (worker) onOpenWorkerDrawer(worker);
                                }
                              }}
                              className="flex cursor-pointer items-center justify-between rounded-xl bg-zinc-50 px-2 py-1.5 transition-colors duration-200 hover:bg-white/10 dark:bg-zinc-800/80 dark:hover:bg-white/5"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getWorkerAvatarColor(a.worker_id, worker)}`}
                                  title={workerDisplayName(worker)}
                                >
                                  {getWorkerInitials(worker)}
                                </span>
                                <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                                  {workerDisplayName(worker)}
                                  {(assignmentCountByWorkerThisWeek[
                                    a.worker_id
                                  ] ?? 0) > 0 && (
                                    <span className="text-zinc-500 dark:text-zinc-400">
                                      •
                                      {
                                        assignmentCountByWorkerThisWeek[
                                          a.worker_id
                                        ]
                                      }{' '}
                                      השבוע
                                    </span>
                                  )}
                                  {hasConstraint && (
                                    <span
                                      className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                      title="קיים אילוץ בתאריך זה"
                                    >
                                      ⚠️ קונפליקט
                                    </span>
                                  )}
                                </span>
                                {worker && !worker.user_id && (
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                    (טרם נרשם)
                                  </span>
                                )}
                                {unavailable && (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase dark:bg-amber-500/20 dark:text-amber-300">
                                    לא זמין
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUnassign(a.id);
                                }}
                                disabled={unassigningId === a.id}
                                className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                {unassigningId === a.id ? 'מסיר…' : 'הסרה'}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div
                    className="space-y-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      שיבוץ כונן נוסף
                    </div>
                    <Dropdown
                      placeholder="בחירת כונן…"
                      value=""
                      onSelect={(workerId) => {
                        if (!workerId) return;
                        void onAssign(shift, workerId);
                      }}
                      items={[
                        { value: '', label: 'בחירת כונן…' },
                        ...workersSorted.map((w) => {
                          const unavailable = hasUnavailableConstraint(
                            constraintsByWorkerDateType,
                            w.user_id ?? null,
                            shift.date,
                            shift.type
                          );
                          const count =
                            assignmentCountByWorkerThisWeek[w.id] ?? 0;
                          const suffixParts: string[] = [];
                          if (!w.user_id) suffixParts.push('טרם נרשם');
                          if (unavailable) suffixParts.push('לא זמין');
                          if (count > 0)
                            suffixParts.push(`${count} שיבוצים השבוע`);
                          const suffix =
                            suffixParts.length > 0
                              ? ` (${suffixParts.join(' · ')})`
                              : '';
                          return {
                            value: w.id,
                            label: `${workerDisplayName(w)}${suffix}`,
                          };
                        }),
                      ]}
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      אם כונן מסומן כלא זמין בתאריך וסוג משמרת זהה, תוצג כאן
                      אזהרה, אך לא תהיה חסימה של השיבוץ.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}
