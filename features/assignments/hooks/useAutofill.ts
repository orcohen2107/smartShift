import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api/apiFetch';
import { isDatePast } from '@/features/assignments/utils';
import type {
  AutofillProposalItem,
  EditingProposal,
  ReplacementEdit,
} from '@/features/assignments/types';
import type {
  Assignment,
  AssignmentsOverview,
  Worker,
} from '@/lib/utils/interfaces';

export function useAutofill(params: {
  selectedBoardId: string | null;
  weekDates: string[];
  setError: (err: string | null) => void;
  updateOverview: (
    updater: (prev: AssignmentsOverview) => AssignmentsOverview
  ) => void;
  load: () => Promise<void>;
  workersById: Record<string, Worker>;
}) {
  const {
    selectedBoardId,
    weekDates,
    setError,
    updateOverview,
    load,
    workersById,
  } = params;

  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);
  const [autofillPreview, setAutofillPreview] = useState<
    AutofillProposalItem[] | null
  >(null);
  const [autofillApplying, setAutofillApplying] = useState(false);
  const [editingProposal, setEditingProposal] =
    useState<EditingProposal | null>(null);
  const [replacementEdits, setReplacementEdits] = useState<ReplacementEdit[]>(
    []
  );

  const handleAutofill = useCallback(async () => {
    if (!selectedBoardId || !weekDates.length) return;
    setError(null);
    setAutofillSuccess(null);
    setAutofillPreview(null);
    setAutofillLoading(true);
    try {
      const fromDate = weekDates[0]!;
      const toDate = weekDates[6]!;
      const res = await apiFetch<{
        proposed: AutofillProposalItem[];
      }>('/api/assignments/autofill/preview', {
        method: 'POST',
        json: {
          board_id: selectedBoardId,
          from_date: fromDate,
          to_date: toDate,
        },
      });
      const proposed = res.proposed ?? [];
      if (proposed.length > 0) {
        setAutofillPreview(proposed);
      } else {
        setAutofillSuccess('אין משמרות ריקות לשיבוץ');
        setTimeout(() => setAutofillSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשיבוץ אוטומטי');
    } finally {
      setAutofillLoading(false);
    }
  }, [selectedBoardId, weekDates, setError]);

  const handleAutofillConfirm = useCallback(async () => {
    const hasProposed = (autofillPreview?.length ?? 0) > 0;
    const hasReplacements = replacementEdits.length > 0;
    if (
      (!hasProposed && !hasReplacements) ||
      !selectedBoardId ||
      !weekDates.length
    )
      return;
    setError(null);
    setAutofillApplying(true);
    try {
      const notPast = (d: string) => !isDatePast(d);
      const additions = [
        ...(autofillPreview ?? [])
          .filter((p) => notPast(p.date))
          .map((p) => ({
            date: p.date,
            type: p.type,
            worker_id: p.worker_id,
          })),
        ...replacementEdits
          .filter((r) => notPast(r.date))
          .map((r) => ({
            date: r.date,
            type: r.type,
            worker_id: r.to_worker_id,
          })),
      ];
      const removals = replacementEdits
        .filter((r) => notPast(r.date))
        .map((r) => ({
          date: r.date,
          type: r.type,
          worker_id: r.from_worker_id,
        }));
      const res = await apiFetch<{
        created: number;
        removed: number;
        assignments: Assignment[];
      }>('/api/assignments/autofill/apply', {
        method: 'POST',
        json: {
          board_id: selectedBoardId,
          from_date: weekDates[0],
          to_date: weekDates[6],
          additions,
          removals,
        },
      });
      const created = res.assignments ?? [];
      const removed = res.removed ?? 0;
      if (created.length > 0 || removed > 0) {
        updateOverview((prev) => ({
          ...prev,
          assignments: [...prev.assignments, ...created],
        }));
        void load();
        const msg =
          removed > 0
            ? `הוחלפו ${removed} שיבוצים, נוספו ${created.length}`
            : `נוספו ${created.length} שיבוצים`;
        setAutofillSuccess(msg);
        setTimeout(() => setAutofillSuccess(null), 4000);
      }
      setAutofillPreview(null);
      setReplacementEdits([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביישום השיבוץ');
    } finally {
      setAutofillApplying(false);
    }
  }, [
    autofillPreview,
    replacementEdits,
    selectedBoardId,
    weekDates,
    updateOverview,
    load,
    setError,
  ]);

  const handleAutofillCancel = useCallback(() => {
    setAutofillPreview(null);
    setEditingProposal(null);
    setReplacementEdits([]);
  }, []);

  const handleReplaceProposal = useCallback(
    (date: string, type: string, oldWorkerId: string, newWorkerId: string) => {
      const worker = workersById[newWorkerId];
      const newName =
        worker?.full_name ?? worker?.email ?? newWorkerId.slice(0, 8);

      const inProposed = autofillPreview?.some(
        (p) => p.date === date && p.type === type && p.worker_id === oldWorkerId
      );
      if (inProposed) {
        setAutofillPreview((prev) => {
          if (!prev) return prev;
          const idx = prev.findIndex(
            (p) =>
              p.date === date && p.type === type && p.worker_id === oldWorkerId
          );
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = {
            ...next[idx]!,
            worker_id: newWorkerId,
            worker_name: newName,
          };
          return next;
        });
      } else {
        setReplacementEdits((prev) => {
          const existingIdx = prev.findIndex(
            (r) =>
              r.date === date &&
              r.type === type &&
              r.to_worker_id === oldWorkerId
          );
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = {
              ...next[existingIdx]!,
              to_worker_id: newWorkerId,
              to_worker_name: newName,
            };
            return next;
          }
          return [
            ...prev,
            {
              date,
              type,
              from_worker_id: oldWorkerId,
              to_worker_id: newWorkerId,
              to_worker_name: newName,
            },
          ];
        });
      }
      setEditingProposal(null);
    },
    [workersById, autofillPreview]
  );

  return {
    autofillLoading,
    autofillSuccess,
    autofillPreview,
    autofillApplying,
    editingProposal,
    setEditingProposal,
    replacementEdits,
    handleAutofill,
    handleAutofillConfirm,
    handleAutofillCancel,
    handleReplaceProposal,
  };
}
