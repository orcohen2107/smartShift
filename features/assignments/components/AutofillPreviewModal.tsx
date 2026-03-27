'use client';

import Dropdown from '@/components/Dropdown';
import type { Assignment, Shift, ShiftBoard, Worker } from '@/lib/utils/interfaces';
import { ShiftType } from '@/lib/utils/enums';
import type {
  AutofillProposalItem,
  EditingProposal,
  ReplacementEdit,
} from '@/features/assignments/types';
import {
  isDatePast,
  getDayName,
  formatDateHe,
  workerDisplayName,
} from '@/features/assignments/utils';

type Props = {
  autofillPreview: AutofillProposalItem[];
  selectedBoard: ShiftBoard | null;
  weekDates: string[];
  getShiftByDateType: (date: string, type: ShiftType) => Shift | undefined;
  getAssignmentsForShift: (shiftId: string) => Assignment[];
  workersById: Record<string, Worker>;
  workersSorted: Worker[];
  replacementEdits: ReplacementEdit[];
  editingProposal: EditingProposal | null;
  setEditingProposal: (p: EditingProposal | null) => void;
  handleReplaceProposal: (
    date: string,
    type: string,
    oldWorkerId: string,
    newWorkerId: string
  ) => void;
  autofillApplying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AutofillPreviewModal({
  autofillPreview,
  selectedBoard,
  weekDates,
  getShiftByDateType,
  getAssignmentsForShift,
  workersById,
  workersSorted,
  replacementEdits,
  editingProposal,
  setEditingProposal,
  handleReplaceProposal,
  autofillApplying,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        dir="rtl"
      >
        <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            הצעת שיבוץ אוטומטי – כל השבוע
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            השיבוץ מוצע לפי אילוצים, עומס וגיוון מהשבוע שעבר. לחץ על כל כונן
            להחלפה. כונן יכול להופיע במשמרות שונות בימים שונים. סימון{' '}
            <span className="rounded bg-amber-500/20 px-1 py-0.5 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
              חדש
            </span>{' '}
            = שיבוץ מוצע.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  תאריך
                </th>
                {selectedBoard?.single_person_for_day ? (
                  <th className="p-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    כל היום
                  </th>
                ) : (
                  <>
                    <th className="p-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      יום
                    </th>
                    <th className="p-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      לילה
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {weekDates.map((date) => {
                const isFullDay =
                  selectedBoard?.single_person_for_day ?? false;
                const shiftDay = getShiftByDateType(date, ShiftType.Day);
                const shiftNight = getShiftByDateType(date, ShiftType.Night);
                const shiftFullDay = getShiftByDateType(
                  date,
                  ShiftType.FullDay
                );
                const shiftForDay = isFullDay ? shiftFullDay : shiftDay;
                const shiftForNight = isFullDay ? null : shiftNight;

                const getCellAssignments = (
                  shift: Shift | undefined,
                  cellType: ShiftType
                ) => {
                  const existing = shift
                    ? getAssignmentsForShift(shift.id)
                    : [];
                  const proposed = autofillPreview.filter(
                    (p) =>
                      p.date === date &&
                      p.type ===
                        (cellType === ShiftType.FullDay
                          ? 'full_day'
                          : cellType === ShiftType.Day
                            ? 'day'
                            : 'night')
                  );
                  return { existing, proposed };
                };

                const renderPreviewCell = (
                  shift: Shift | undefined,
                  cellType: ShiftType
                ) => {
                  const canEditCell = !isDatePast(date);
                  const typeStr =
                    cellType === ShiftType.FullDay
                      ? 'full_day'
                      : cellType === ShiftType.Day
                        ? 'day'
                        : 'night';
                  const { existing, proposed } = getCellAssignments(
                    shift,
                    cellType
                  );
                  const replacedFrom = replacementEdits.filter(
                    (r) => r.date === date && r.type === typeStr
                  );
                  const existingFiltered = existing.filter(
                    (a) =>
                      !replacedFrom.some(
                        (r) => r.from_worker_id === a.worker_id
                      )
                  );
                  const proposedFiltered = proposed.filter(
                    (p) =>
                      !replacedFrom.some(
                        (r) => r.to_worker_id === p.worker_id
                      )
                  );
                  const workerIdsInCell = new Set([
                    ...existingFiltered.map((a) => a.worker_id),
                    ...replacedFrom.map((r) => r.to_worker_id),
                    ...proposedFiltered.map((p) => p.worker_id),
                  ]);
                  const availableWorkers = workersSorted.filter(
                    (w) => !workerIdsInCell.has(w.id)
                  );
                  const all = [
                    ...existingFiltered.map((a) => ({
                      workerId: a.worker_id,
                      name: workerDisplayName(workersById[a.worker_id]),
                      isNew: false,
                    })),
                    ...replacedFrom.map((r) => ({
                      workerId: r.to_worker_id,
                      name: r.to_worker_name,
                      isNew: true,
                    })),
                    ...proposedFiltered.map((p) => ({
                      workerId: p.worker_id,
                      name: p.worker_name,
                      isNew: true,
                    })),
                  ];
                  if (all.length === 0) {
                    return (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        —
                      </span>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      {all.map((item, i) => {
                        const isEditing =
                          canEditCell &&
                          editingProposal?.date === date &&
                          editingProposal?.type === typeStr &&
                          editingProposal?.worker_id === item.workerId;

                        if (isEditing) {
                          return (
                            <div
                              key={i}
                              className="inline-flex min-w-[100px]"
                            >
                              <Dropdown
                                placeholder="בחר כונן…"
                                value=""
                                onSelect={(newId) =>
                                  handleReplaceProposal(
                                    date,
                                    typeStr,
                                    item.workerId,
                                    newId
                                  )
                                }
                                items={availableWorkers.map((w) => ({
                                  value: w.id,
                                  label: workerDisplayName(w),
                                }))}
                                buttonClassName="min-h-0 rounded-lg border border-amber-500/50 px-2 py-1 text-xs dark:border-amber-500/40"
                                panelClassName="max-h-40"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingProposal(null)}
                                className="mr-1 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-600 dark:hover:text-zinc-300"
                                title="ביטול"
                              >
                                ×
                              </button>
                            </div>
                          );
                        }

                        return (
                          <span
                            key={i}
                            {...(canEditCell
                              ? {
                                  role: 'button' as const,
                                  tabIndex: 0,
                                  onClick: () =>
                                    setEditingProposal({
                                      date,
                                      type: typeStr,
                                      worker_id: item.workerId,
                                    }),
                                  onKeyDown: (e: React.KeyboardEvent) => {
                                    if (
                                      e.key === 'Enter' ||
                                      e.key === ' '
                                    ) {
                                      e.preventDefault();
                                      setEditingProposal({
                                        date,
                                        type: typeStr,
                                        worker_id: item.workerId,
                                      });
                                    }
                                  },
                                  title: 'לחץ להחלפת כונן',
                                  className:
                                    'inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-800 transition-colors hover:opacity-90 hover:ring-1 hover:ring-amber-500/40 dark:bg-amber-500/25 dark:text-amber-200 dark:hover:ring-amber-500/30',
                                }
                              : {
                                  className:
                                    'inline-flex cursor-default items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800 dark:bg-zinc-700/50 dark:text-zinc-200',
                                })}
                          >
                            {item.name}
                            {item.isNew && (
                              <span className="text-[10px] font-semibold">
                                חדש
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <tr
                    key={date}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="p-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {getDayName(date)} {formatDateHe(date)}
                    </td>
                    {isFullDay ? (
                      <td className="p-2 align-top">
                        {renderPreviewCell(shiftForDay, ShiftType.FullDay)}
                      </td>
                    ) : (
                      <>
                        <td className="p-2 align-top">
                          {renderPreviewCell(shiftForDay, ShiftType.Day)}
                        </td>
                        <td className="p-2 align-top">
                          {renderPreviewCell(
                            shiftForNight ?? undefined,
                            ShiftType.Night
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-zinc-200 p-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={autofillApplying}
            className="flex-1 cursor-pointer rounded-xl border border-zinc-300 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={autofillApplying}
            className="flex-1 cursor-pointer rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            {autofillApplying ? 'מיישם…' : 'אשר שיבוץ'}
          </button>
        </div>
      </div>
    </div>
  );
}
