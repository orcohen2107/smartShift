'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoltIcon, TrashIcon } from '@heroicons/react/20/solid';
import { apiFetch } from '@/lib/api/apiFetch';
import { useAssignments } from '@/features/assignments/contexts/AssignmentsContext';
import { useProfile } from '@/features/profile/contexts/ProfileContext';
import type {
  Assignment,
  Constraint,
  Shift,
  Worker,
} from '@/lib/utils/interfaces';
import { canManage, ShiftType } from '@/lib/utils/enums';
import Dropdown from '@/components/Dropdown';
import { ShiftDetailsDrawer } from '@/components/assignments/ShiftDetailsDrawer';
import { WorkerDetailsDrawer } from '@/components/assignments/WorkerDetailsDrawer';
import type {
  CreateShiftInput,
  AssigningCell,
  PendingConstraintConfirm,
  ShiftDrawerState,
} from '@/features/assignments/types';
import {
  getWeekDates,
  formatDateHe,
  getDayName,
  isDatePast,
  isToday,
  workerDisplayName,
  getWorkerInitials,
  getWorkerAvatarColor,
} from '@/features/assignments/utils';
import { useWeekNavigation } from '@/features/assignments/hooks/useWeekNavigation';
import { useAutofill } from '@/features/assignments/hooks/useAutofill';
import { CreateBoardModal } from '@/features/assignments/components/CreateBoardModal';
import { ConstraintConfirmModal } from '@/features/assignments/components/ConstraintConfirmModal';
import { AssignWorkerModal } from '@/features/assignments/components/AssignWorkerModal';
import { AutofillPreviewModal } from '@/features/assignments/components/AutofillPreviewModal';
import { ShiftListView } from '@/features/assignments/components/ShiftListView';

export default function AssignmentsPage() {
  const router = useRouter();
  const {
    overview,
    loading,
    error,
    setError,
    selectedBoardId,
    setSelectedBoardId,
    load,
    updateOverview,
    hasCachedData,
  } = useAssignments();

  const profile = useProfile();
  const [mounted, setMounted] = useState(false);
  const todayStr = useMemo(() => {
    if (!mounted) return '';
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, [mounted]);
  const [createShiftForm, setCreateShiftForm] = useState<CreateShiftInput>({
    date: '',
    type: ShiftType.Day,
  });
  const [initialWorkerId, setInitialWorkerId] = useState<string>('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [addingWorker, setAddingWorker] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [assigningCell, setAssigningCell] = useState<AssigningCell | null>(
    null
  );
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [creatingShift, setCreatingShift] = useState(false);
  const [assigningCellKey, setAssigningCellKey] = useState<string | null>(null);
  const [pendingConstraintConfirm, setPendingConstraintConfirm] =
    useState<PendingConstraintConfirm | null>(null);
  const [shiftDrawer, setShiftDrawer] = useState<ShiftDrawerState | null>(
    null
  );
  const [workerDrawer, setWorkerDrawer] = useState<Worker | null>(null);

  useEffect(() => {
    if (profile === null) return;
    if (!canManage(profile.role)) {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (hasCachedData || profile === null) return;
    void load();
  }, [hasCachedData, profile, load]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // סינון משמרות לפי לוח נבחר (client-side – אין בקשה נוספת)
  const shiftsFiltered: Shift[] = useMemo(() => {
    const shifts = overview?.shifts ?? [];
    if (!selectedBoardId) return shifts;
    return shifts.filter((s) => s.board_id === selectedBoardId);
  }, [overview?.shifts, selectedBoardId]);

  const shiftsAll: Shift[] = useMemo(() => shiftsFiltered, [shiftsFiltered]);

  const workersById: Record<string, Worker> = useMemo(() => {
    const map: Record<string, Worker> = {};
    overview?.workers.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [overview]);

  /** כוננים לא-מילואים לפי א-ב, ואז מילואים לפי א-ב */
  const workersSorted = useMemo(() => {
    const list = [...(overview?.workers ?? [])];
    const name = (w: Worker) => (w.full_name ?? w.email ?? w.id ?? '').trim();
    return list.sort((a, b) => {
      if (a.is_reserves !== b.is_reserves) return a.is_reserves ? 1 : -1;
      return name(a).localeCompare(name(b), 'he');
    });
  }, [overview?.workers]);

  const constraintsByWorkerDateType: Record<string, Constraint[]> =
    useMemo(() => {
      const map: Record<string, Constraint[]> = {};
      overview?.constraints.forEach((c) => {
        const key = `${c.worker_id}-${c.date}-${c.type}`;
        if (!map[key]) map[key] = [];
        map[key].push(c);
      });
      return map;
    }, [overview]);

  function getAssignmentsForShift(shiftId: string) {
    return overview?.assignments.filter((a) => a.shift_id === shiftId) ?? [];
  }

  function hasConstraintForShift(
    workerId: string,
    date: string,
    shiftType: ShiftType
  ): boolean {
    const constraints = (overview?.constraints ?? []).filter(
      (c) => c.worker_id === workerId && c.date === date
    );
    if (constraints.length === 0) return false;
    if (shiftType === ShiftType.FullDay) return true;
    return constraints.some((c) => c.type === shiftType);
  }

  const selectedBoard = useMemo(
    () => overview?.boards?.find((b) => b.id === selectedBoardId) ?? null,
    [overview?.boards, selectedBoardId]
  );

  const {
    weekOffset,
    setWeekOffset,
    weekDates,
    assignmentsInWeek,
    constraintsInWeek,
    weeklyProgress,
  } = useWeekNavigation({ overview, selectedBoardId, selectedBoard });

  const {
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
  } = useAutofill({
    selectedBoardId,
    weekDates,
    setError,
    updateOverview,
    load,
    workersById,
  });

  const assignmentCountByWorkerThisWeek: Record<string, number> =
    useMemo(() => {
      const counts: Record<string, number> = {};
      const assignments = overview?.assignments ?? [];
      const datesInWeek = new Set(getWeekDates(weekOffset));
      let shiftsInScope = (overview?.shifts ?? []).filter((s) =>
        datesInWeek.has(s.date)
      );
      if (selectedBoardId) {
        shiftsInScope = shiftsInScope.filter(
          (s) => s.board_id === selectedBoardId
        );
      }
      const shiftIdsInWeek = new Set(shiftsInScope.map((s) => s.id));
      assignments.forEach((a) => {
        if (!shiftIdsInWeek.has(a.shift_id)) return;
        counts[a.worker_id] = (counts[a.worker_id] ?? 0) + 1;
      });
      return counts;
    }, [overview?.assignments, overview?.shifts, weekOffset, selectedBoardId]);

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedBoardId || !selectedBoard) {
      setError('יש לבחור לוח שיבוצים לפני יצירת משמרת');
      return;
    }
    setCreatingShift(true);
    try {
      const type = selectedBoard.single_person_for_day
        ? ShiftType.FullDay
        : createShiftForm.type;
      const requiredCount =
        createShiftForm.required_count ?? selectedBoard.workers_per_shift ?? 1;
      const createdShift = await apiFetch<Shift>('/api/shifts', {
        method: 'POST',
        json: {
          date: createShiftForm.date,
          type,
          board_id: selectedBoardId,
          required_count: requiredCount,
        },
      });

      updateOverview((prev) => ({
        ...prev,
        shifts: [...prev.shifts, createdShift],
      }));

      let assignment: {
        id: string;
        shift_id: string;
        worker_id: string;
        created_at: string;
      } | null = null;
      if (initialWorkerId) {
        const workerName =
          workersById[initialWorkerId]?.full_name ??
          workersById[initialWorkerId]?.email ??
          'העובד';
        const shiftType = selectedBoard.single_person_for_day
          ? ShiftType.FullDay
          : createShiftForm.type;
        if (
          hasConstraintForShift(
            initialWorkerId,
            createShiftForm.date,
            shiftType
          )
        ) {
          setPendingConstraintConfirm({
            shiftId: createdShift.id,
            workerId: initialWorkerId,
            workerName,
          });
          setInitialWorkerId('');
        } else {
          assignment = await apiFetch('/api/assignments', {
            method: 'POST',
            json: { shift_id: createdShift.id, worker_id: initialWorkerId },
          });
          setInitialWorkerId('');
          updateOverview((prev) => ({
            ...prev,
            assignments: [...prev.assignments, assignment!],
          }));
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create shift');
    } finally {
      setCreatingShift(false);
    }
  }

  async function doAssign(shiftId: string, workerId: string) {
    const assignment = await apiFetch<{
      id: string;
      shift_id: string;
      worker_id: string;
      created_at: string;
    }>('/api/assignments', {
      method: 'POST',
      json: { shift_id: shiftId, worker_id: workerId },
    });
    updateOverview((prev) => ({
      ...prev,
      assignments: [...prev.assignments, assignment],
    }));
  }

  async function handleAssign(shift: Shift, workerId: string) {
    setError(null);
    const workerName =
      workersById[workerId]?.full_name ??
      workersById[workerId]?.email ??
      'העובד';
    if (hasConstraintForShift(workerId, shift.date, shift.type)) {
      setPendingConstraintConfirm({ shiftId: shift.id, workerId, workerName });
      return;
    }
    try {
      await doAssign(shift.id, workerId);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to assign worker');
    }
  }

  async function handleUnassign(assignmentId: string) {
    setError(null);
    setUnassigningId(assignmentId);
    try {
      await apiFetch(
        `/api/assignments?assignment_id=${encodeURIComponent(assignmentId)}`,
        { method: 'DELETE' }
      );
      updateOverview((prev) => ({
        ...prev,
        assignments: prev.assignments.filter((a) => a.id !== assignmentId),
      }));
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'Failed to remove assignment'
      );
    } finally {
      setUnassigningId(null);
    }
  }

  async function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkerName.trim()) return;
    setError(null);
    setAddingWorker(true);
    try {
      const worker = await apiFetch<Worker>('/api/workers', {
        method: 'POST',
        json: { full_name: newWorkerName.trim() },
      });
      setNewWorkerName('');
      updateOverview((prev) => ({
        ...prev,
        workers: [...prev.workers, worker],
      }));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to add worker');
    } finally {
      setAddingWorker(false);
    }
  }

  function getShiftByDateType(date: string, t: ShiftType): Shift | undefined {
    return shiftsFiltered.find((s) => s.date === date && s.type === t);
  }

  async function ensureShiftAndAssign(
    date: string,
    shiftType: ShiftType,
    workerId: string
  ) {
    setAssigningCell(null);
    setError(null);
    if (!selectedBoardId || !selectedBoard) {
      setError('יש לבחור לוח שיבוצים לפני שיבוץ');
      return;
    }
    setAssigningCellKey(`${date}-${shiftType}-${workerId}`);
    try {
      const type = selectedBoard.single_person_for_day
        ? ShiftType.FullDay
        : shiftType;
      let shift = getShiftByDateType(date, type);
      if (!shift) {
        shift = await apiFetch<Shift>('/api/shifts', {
          method: 'POST',
          json: {
            date,
            type,
            board_id: selectedBoardId ?? undefined,
            required_count: selectedBoard?.workers_per_shift ?? 1,
          },
        });
        updateOverview((prev) => ({
          ...prev,
          shifts: [...prev.shifts, shift!],
        }));
      }
      const workerName =
        workersById[workerId]?.full_name ??
        workersById[workerId]?.email ??
        'העובד';
      const actualShiftType = selectedBoard.single_person_for_day
        ? ShiftType.FullDay
        : shiftType;
      if (hasConstraintForShift(workerId, date, actualShiftType)) {
        setAssigningCellKey(null);
        setPendingConstraintConfirm({
          shiftId: shift.id,
          workerId,
          workerName,
        });
        return;
      }
      await doAssign(shift.id, workerId);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setAssigningCellKey(null);
    }
  }

  const shiftsById: Record<string, Shift> = useMemo(() => {
    const map: Record<string, Shift> = {};
    (overview?.shifts ?? []).forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [overview?.shifts]);

  if (profile === null || !canManage(profile.role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  // עד שלא נטען overview – מציגים טעינה כדי שעדכוני state (שיבוץ/משמרת) יעבדו
  if (!overview) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p>{loading ? 'טוען...' : 'שגיאה בטעינה'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {loading && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              טוען נתונים...
            </p>
          </div>
        </div>
      )}

      <CreateBoardModal
        open={showCreateBoard}
        onClose={() => setShowCreateBoard(false)}
        onCreated={(board) => {
          setShowCreateBoard(false);
          setSelectedBoardId(board.id);
          updateOverview((prev) => ({
            ...prev,
            boards: [...prev.boards, board],
          }));
        }}
      />

      {pendingConstraintConfirm && (
        <ConstraintConfirmModal
          pending={pendingConstraintConfirm}
          onConfirm={async (shiftId, workerId) => {
            try {
              await doAssign(shiftId, workerId);
              setPendingConstraintConfirm(null);
            } catch (err: unknown) {
              console.error(err);
              setError(
                err instanceof Error
                  ? err.message
                  : 'Failed to assign worker'
              );
            }
          }}
          onCancel={() => setPendingConstraintConfirm(null)}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            שיבוצים
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ניהול משמרות ושיבוץ כוננים (שינויים — מנהל בלבד).
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="רענן נתונים"
          >
            רענן
          </button>
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Dropdown
                placeholder="כל הלוחות"
                value={selectedBoardId ?? ''}
                onSelect={(id) => setSelectedBoardId(id || null)}
                items={[
                  { value: '', label: 'כל הלוחות' },
                  ...(overview?.boards?.map((b) => ({
                    value: b.id,
                    label: `${b.name}${b.single_person_for_day ? ' (אדם יחיד)' : ` (${b.workers_per_shift} במשמרת)`}`,
                  })) ?? []),
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateBoard(true)}
              className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + לוח חדש
            </button>
          </div>
          <div className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 p-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900/80">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`cursor-pointer rounded-full px-3 py-1 ${viewMode === 'list' ? 'bg-emerald-500 text-emerald-950 shadow-sm' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
            >
              רשימה
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`cursor-pointer rounded-full px-3 py-1 ${viewMode === 'calendar' ? 'bg-emerald-500 text-emerald-950 shadow-sm' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
            >
              לוח
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleAddWorker}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="min-w-[180px] space-y-1">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            הוספת כונן לרשימת הכוננים (לפני הרשמה)
          </label>
          <input
            type="text"
            value={newWorkerName}
            onChange={(e) => setNewWorkerName(e.target.value)}
            placeholder="שם מלא"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={addingWorker || !newWorkerName.trim()}
          className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addingWorker ? 'מוסיף…' : 'הוסף לרשימה'}
        </button>
      </form>

      <form
        onSubmit={handleCreateShift}
        className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          יצירת משמרת
          {selectedBoard && (
            <span className="mr-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              (לוח: {selectedBoard.name})
            </span>
          )}
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              תאריך
            </label>
            <input
              type="date"
              required
              min={todayStr}
              value={createShiftForm.date}
              onChange={(e) =>
                setCreateShiftForm((prev) => ({
                  ...prev,
                  date: e.target.value,
                }))
              }
              className="w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:[color-scheme:dark]"
            />
          </div>
          {!selectedBoard?.single_person_for_day && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                סוג משמרת
              </label>
              <Dropdown
                value={createShiftForm.type}
                onSelect={(v) =>
                  setCreateShiftForm((prev) => ({
                    ...prev,
                    type: v as ShiftType,
                  }))
                }
                items={[
                  { value: 'day', label: 'משמרת יום' },
                  { value: 'night', label: 'משמרת לילה' },
                ]}
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              שיבוץ ראשוני (אופציונלי)
            </label>
            <Dropdown
              placeholder="ללא שיבוץ התחלתי"
              value={initialWorkerId}
              onSelect={setInitialWorkerId}
              items={[
                { value: '', label: 'ללא שיבוץ התחלתי' },
                ...workersSorted.map((w) => {
                  const count = assignmentCountByWorkerThisWeek[w.id] ?? 0;
                  const suffixParts: string[] = [];
                  if (!w.user_id) suffixParts.push('טרם נרשם');
                  if (count > 0) suffixParts.push(`${count} שיבוצים השבוע`);
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
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          רק מנהלים יכולים ליצור או לערוך משמרות. כוננים יכולים לצפות בשיבוצים.
          {!selectedBoard && (
            <span className="mt-1 block text-amber-600 dark:text-amber-400">
              יש לבחור לוח שיבוצים כדי ליצור משמרת חדשה.
            </span>
          )}
        </p>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedBoard || creatingShift}
            className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingShift ? 'יוצר…' : 'יצירת משמרת'}
          </button>
        </div>
      </form>

      {viewMode === 'calendar' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              לוח שבועי
            </h2>
            <div className="flex items-center gap-2">
              {autofillSuccess && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {autofillSuccess}
                </span>
              )}
              <button
                type="button"
                onClick={handleAutofill}
                disabled={!selectedBoardId || autofillLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
              >
                <BoltIcon className="h-4 w-4" aria-hidden />
                {autofillLoading ? 'משבץ…' : 'שיבוץ אוטומטי'}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setWeekOffset((o) => o - 1)}
                  className="cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                  title="שבוע קודם"
                >
                  →
                </button>
                <span className="min-w-[120px] text-center text-sm text-zinc-700 dark:text-zinc-300">
                  {weekDates[0] && formatDateHe(weekDates[0])} –{' '}
                  {weekDates[6] && formatDateHe(weekDates[6])}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffset((o) => o + 1)}
                  className="cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                  title="שבוע הבא"
                >
                  ←
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white/50 px-3 py-2 dark:border-zinc-700/80 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                שיבוץ השבוע
              </span>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300 dark:bg-emerald-400"
                    style={{
                      width: `${weeklyProgress.total > 0 ? (weeklyProgress.daysFullyAssigned / weeklyProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="min-w-[80px] text-left text-xs font-medium text-zinc-600 tabular-nums dark:text-zinc-400">
                  {weeklyProgress.daysFullyAssigned} / {weeklyProgress.total}{' '}
                  ימים שובצו
                </span>
              </div>
            </div>
          </div>
          <div
            className="-mx-3 overflow-x-auto overflow-y-auto rounded-xl border border-zinc-200 bg-white sm:mx-0 sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900/80"
            style={{ maxHeight: 'calc(100dvh - 14rem)' }}
          >
            <table className="w-full min-w-[480px] text-sm sm:min-w-[600px]">
              <thead>
                <tr className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)]">
                  <th className="sticky right-0 z-[21] min-w-[140px] border-s border-zinc-200/80 bg-white/95 p-2.5 text-right text-xs font-semibold tracking-wide text-zinc-600 uppercase backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-400">
                    תאריך
                  </th>
                  {selectedBoard?.single_person_for_day ? (
                    <th className="p-2.5 text-right text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
                      כל היום
                    </th>
                  ) : (
                    <>
                      <th className="p-2.5 text-right text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
                        משמרת יום
                      </th>
                      <th className="p-2.5 text-right text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-400">
                        משמרת לילה
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date, rowIndex) => {
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
                  const assignDay = shiftForDay
                    ? getAssignmentsForShift(shiftForDay.id)
                    : [];
                  const assignNight = shiftForNight
                    ? getAssignmentsForShift(shiftForNight.id)
                    : [];
                  const isPast = isDatePast(date);
                  const canEdit = !isPast;

                  const renderCell = (
                    shift: Shift | null | undefined,
                    assigns: Assignment[],
                    cellType: ShiftType
                  ) => {
                    const isAssigningHere = assigningCellKey?.startsWith(
                      `${date}-${cellType}-`
                    );
                    const required = shift?.required_count ?? 1;
                    const current = assigns.length;
                    const shiftStatus: 'full' | 'missing' | 'empty' =
                      current >= required
                        ? 'full'
                        : current > 0
                          ? 'missing'
                          : 'empty';
                    const showStatusBadge = shift || !isPast;
                    return (
                      <td className="p-2 align-top" key={String(cellType)}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setShiftDrawer({
                              date,
                              cellType,
                              shift: shift ?? null,
                              assigns,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setShiftDrawer({
                                date,
                                cellType,
                                shift: shift ?? null,
                                assigns,
                              });
                            }
                          }}
                          className={`min-h-[44px] cursor-pointer rounded-lg border border-dashed p-2 transition-colors duration-200 hover:border-zinc-300 hover:bg-white/5 dark:hover:border-zinc-600 dark:hover:bg-white/[0.05] ${
                            !shift && isPast
                              ? 'border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50'
                              : 'border-zinc-200 dark:border-zinc-700'
                          } ${!shift && isPast ? 'opacity-60' : ''}`}
                        >
                          {showStatusBadge && (
                            <span
                              className={`mb-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                shiftStatus === 'full'
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300'
                                  : shiftStatus === 'missing'
                                    ? 'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300'
                                    : 'bg-red-500/20 text-red-700 dark:bg-red-500/25 dark:text-red-300'
                              }`}
                            >
                              {shiftStatus === 'full'
                                ? 'מלא'
                                : shiftStatus === 'missing'
                                  ? 'חסר כונן'
                                  : 'ריק'}
                            </span>
                          )}
                          {isAssigningHere && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              משבץ…
                            </span>
                          )}
                          {assigns.map((a) => {
                            const w = workersById[a.worker_id];
                            const hasConstraint =
                              shift &&
                              hasConstraintForShift(
                                a.worker_id,
                                shift.date,
                                cellType
                              );
                            const workload =
                              assignmentCountByWorkerThisWeek[a.worker_id] ?? 0;
                            return (
                              <div
                                key={a.id}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (w) setWorkerDrawer(w);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (w) setWorkerDrawer(w);
                                  }
                                }}
                                className="flex cursor-pointer items-center justify-between gap-1 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-white/10 dark:hover:bg-white/5"
                              >
                                <span className="inline-flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getWorkerAvatarColor(a.worker_id, w)}`}
                                    title={workerDisplayName(w)}
                                  >
                                    {getWorkerInitials(w)}
                                  </span>
                                  <span className="font-medium">
                                    {workerDisplayName(w)}
                                  </span>
                                  {workload > 0 && (
                                    <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                                      • {workload} השבוע
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
                                {canEdit && shift && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnassign(a.id);
                                    }}
                                    disabled={unassigningId === a.id}
                                    className="inline-flex cursor-pointer items-center gap-1 text-red-500 hover:underline disabled:opacity-50 dark:text-red-400"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                    {unassigningId === a.id ? 'מסיר…' : 'הסר'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {canEdit && !isAssigningHere && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigningCell({
                                  date,
                                  type: cellType,
                                  shiftId: shift?.id ?? null,
                                });
                              }}
                              className="mt-1 cursor-pointer text-xs font-medium text-emerald-600 dark:text-emerald-400"
                            >
                              + שבץ כונן
                            </button>
                          )}
                          {!shift && isPast && !isAssigningHere && (
                            <span className="mt-1 text-xs text-zinc-400">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  };

                  const isOddRow = rowIndex % 2 === 1;
                  return (
                    <tr
                      key={date}
                      className={`border-b border-zinc-100 transition-colors duration-150 dark:border-zinc-800 ${
                        isToday(date)
                          ? 'bg-emerald-500/5 ring-1 ring-emerald-500/20 hover:bg-emerald-500/8 dark:bg-emerald-500/10 dark:ring-emerald-500/15 dark:hover:bg-emerald-500/12'
                          : isOddRow
                            ? 'bg-zinc-50/50 hover:bg-white/30 dark:bg-white/[0.02] dark:hover:bg-white/[0.03]'
                            : 'hover:bg-white/30 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <td
                        className={`sticky right-0 z-10 min-w-[140px] border-s border-zinc-200/60 p-2.5 font-medium text-zinc-900 dark:border-zinc-700/60 dark:text-zinc-100 ${
                          isToday(date)
                            ? 'bg-emerald-500/5 dark:bg-emerald-500/10'
                            : isOddRow
                              ? 'bg-zinc-50/50 dark:bg-white/[0.02]'
                              : 'bg-white dark:bg-zinc-900/80'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isToday(date) && (
                            <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              היום
                            </span>
                          )}
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {getDayName(date)}
                          </span>{' '}
                          {formatDateHe(date)}
                        </span>
                      </td>
                      {isFullDay ? (
                        renderCell(shiftForDay, assignDay, ShiftType.FullDay)
                      ) : (
                        <>
                          {renderCell(shiftForDay, assignDay, ShiftType.Day)}
                          {renderCell(
                            shiftForNight,
                            assignNight,
                            ShiftType.Night
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {autofillPreview && autofillPreview.length > 0 && (
            <AutofillPreviewModal
              autofillPreview={autofillPreview}
              selectedBoard={selectedBoard}
              weekDates={weekDates}
              getShiftByDateType={getShiftByDateType}
              getAssignmentsForShift={getAssignmentsForShift}
              workersById={workersById}
              workersSorted={workersSorted}
              replacementEdits={replacementEdits}
              editingProposal={editingProposal}
              setEditingProposal={setEditingProposal}
              handleReplaceProposal={handleReplaceProposal}
              autofillApplying={autofillApplying}
              onCancel={handleAutofillCancel}
              onConfirm={() => void handleAutofillConfirm()}
            />
          )}

          {assigningCell && (
            <AssignWorkerModal
              assigningCell={assigningCell}
              workersSorted={workersSorted}
              assignmentCountByWorkerThisWeek={assignmentCountByWorkerThisWeek}
              onSelect={(date, type, workerId) =>
                void ensureShiftAndAssign(date, type, workerId)
              }
              onClose={() => setAssigningCell(null)}
            />
          )}
        </section>
      )}

      {viewMode === 'list' && (
        <ShiftListView
          shifts={shiftsAll}
          workersById={workersById}
          workersSorted={workersSorted}
          assignmentCountByWorkerThisWeek={assignmentCountByWorkerThisWeek}
          constraintsByWorkerDateType={constraintsByWorkerDateType}
          getAssignmentsForShift={getAssignmentsForShift}
          hasConstraintForShift={hasConstraintForShift}
          onUnassign={handleUnassign}
          onAssign={handleAssign}
          onOpenShiftDrawer={setShiftDrawer}
          onOpenWorkerDrawer={setWorkerDrawer}
          unassigningId={unassigningId}
          error={error}
        />
      )}

      <ShiftDetailsDrawer
        isOpen={!!shiftDrawer}
        onClose={() => setShiftDrawer(null)}
        shift={shiftDrawer?.shift ?? null}
        date={shiftDrawer?.date ?? ''}
        cellType={shiftDrawer?.cellType ?? ShiftType.Day}
        assigns={shiftDrawer?.assigns ?? []}
        workersById={workersById}
        workersSorted={workersSorted}
        getWorkerDisplayName={workerDisplayName}
        getWorkerInitials={getWorkerInitials}
        getWorkerAvatarColor={getWorkerAvatarColor}
        hasConstraintForShift={hasConstraintForShift}
        formatDateHe={formatDateHe}
        getDayName={getDayName}
        canEdit={!shiftDrawer?.date ? true : !isDatePast(shiftDrawer.date)}
        onUnassign={handleUnassign}
        onAddWorker={handleAssign}
        onOpenAssignModal={(date, type) =>
          setAssigningCell({ date, type, shiftId: null })
        }
        unassigningId={unassigningId}
      />

      <WorkerDetailsDrawer
        isOpen={!!workerDrawer}
        onClose={() => setWorkerDrawer(null)}
        worker={workerDrawer}
        workersById={workersById}
        shiftsById={shiftsById}
        assignmentsInWeek={assignmentsInWeek}
        constraintsInWeek={constraintsInWeek}
        getWorkerDisplayName={workerDisplayName}
        getWorkerInitials={getWorkerInitials}
        getWorkerAvatarColor={getWorkerAvatarColor}
        formatDateHe={formatDateHe}
        getDayName={getDayName}
      />
    </div>
  );
}
