'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoltIcon, TrashIcon } from '@heroicons/react/20/solid';
import { apiFetch } from '@/lib/api/apiFetch';
import { useAssignments } from '@/contexts/AssignmentsContext';
import { useProfile } from '@/contexts/ProfileContext';
import type {
  Assignment,
  Constraint,
  Shift,
  ShiftBoard,
  Worker,
} from '@/lib/utils/interfaces';
import { canManage, ConstraintStatus, ShiftType } from '@/lib/utils/enums';
import Checkbox from '@/components/Checkbox';
import Dropdown from '@/components/Dropdown';
import { ShiftDetailsDrawer } from '@/components/assignments/ShiftDetailsDrawer';
import { WorkerDetailsDrawer } from '@/components/assignments/WorkerDetailsDrawer';

type CreateShiftInput = {
  date: string;
  type: ShiftType;
  required_count?: number;
};

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
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardWorkersPerShift, setNewBoardWorkersPerShift] = useState(1);
  const [newBoardSinglePerson, setNewBoardSinglePerson] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [assigningCell, setAssigningCell] = useState<{
    date: string;
    type: ShiftType;
    shiftId: string | null;
  } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [creatingShift, setCreatingShift] = useState(false);
  const [assigningCellKey, setAssigningCellKey] = useState<string | null>(null);
  const [pendingConstraintConfirm, setPendingConstraintConfirm] = useState<{
    shiftId: string;
    workerId: string;
    workerName: string;
  } | null>(null);
  const [assigningFromConstraintModal, setAssigningFromConstraintModal] =
    useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);
  const [shiftDrawer, setShiftDrawer] = useState<{
    date: string;
    cellType: ShiftType;
    shift: Shift | null;
    assigns: Assignment[];
  } | null>(null);
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

  /** כוננים לא-מילואים לפי א-ב, ואז מילואים לפי א-ב */
  const workersSorted = useMemo(() => {
    const list = [...(overview?.workers ?? [])];
    const name = (w: Worker) => (w.full_name ?? w.email ?? w.id ?? '').trim();
    return list.sort((a, b) => {
      if (a.is_reserves !== b.is_reserves) return a.is_reserves ? 1 : -1;
      return name(a).localeCompare(name(b), 'he');
    });
  }, [overview?.workers]);

  const workerDisplayName = (w: Worker | undefined) =>
    w
      ? `${w.full_name ?? w.email ?? w.id ?? '—'}${w.is_reserves ? ' (מילואים)' : ''}`
      : '—';

  const AVATAR_COLORS = [
    'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
    'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300',
    'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
    'bg-rose-500/20 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300',
    'bg-cyan-500/20 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-300',
  ];

  const WORKER_AVATAR_OVERRIDES: Record<string, string> = {
    'אור כהן':
      'bg-red-500/20 text-red-700 dark:bg-red-500/25 dark:text-red-300',
  };

  function getWorkerInitials(w: Worker | undefined): string {
    if (!w) return '—';
    const name = (w.full_name ?? w.email ?? '').trim();
    if (!name) return (w.id ?? '?').slice(0, 2).toUpperCase();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (
        (parts[0]!.charAt(0) ?? '') + (parts[parts.length - 1]!.charAt(0) ?? '')
      );
    }
    return name.slice(0, 2);
  }

  function getWorkerAvatarColor(workerId: string, worker?: Worker): string {
    const name = worker
      ? workerDisplayName(worker)
          .replace(/\s*\(מילואים\)$/, '')
          .trim()
      : '';
    if (name && WORKER_AVATAR_OVERRIDES[name])
      return WORKER_AVATAR_OVERRIDES[name]!;
    let h = 0;
    for (let i = 0; i < workerId.length; i++)
      h = (h << 5) - h + workerId.charCodeAt(i);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
  }

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

  function hasUnavailableConstraint(
    profileId: string | null,
    date: string,
    shiftType: ShiftType
  ) {
    if (!profileId) return false;
    const key = `${profileId}-${date}-${shiftType}`;
    return (constraintsByWorkerDateType[key] ?? []).some(
      (c) => c.status === ConstraintStatus.Unavailable
    );
  }

  const selectedBoard = useMemo(
    () => overview?.boards?.find((b) => b.id === selectedBoardId) ?? null,
    [overview?.boards, selectedBoardId]
  );

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    setError(null);
    setCreatingBoard(true);
    try {
      const board = await apiFetch<ShiftBoard>('/api/boards', {
        method: 'POST',
        json: {
          name: newBoardName.trim(),
          workers_per_shift: newBoardWorkersPerShift,
          single_person_for_day: newBoardSinglePerson,
        },
      });
      setNewBoardName('');
      setNewBoardWorkersPerShift(1);
      setNewBoardSinglePerson(false);
      setShowCreateBoard(false);
      setSelectedBoardId(board.id);
      updateOverview((prev) => ({
        ...prev,
        boards: [...prev.boards, board],
      }));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setCreatingBoard(false);
    }
  }

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

  function getWeekDates(offset: number): string[] {
    const out: string[] = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + offset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
    return out;
  }

  const DAY_NAMES_HE = [
    'ראשון',
    'שני',
    'שלישי',
    'רביעי',
    'חמישי',
    'שישי',
    'שבת',
  ];

  function formatDateHe(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  }

  function getDayName(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return DAY_NAMES_HE[date.getDay()] ?? '';
  }

  function isDatePast(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date < today;
  }

  function isToday(dateStr: string): boolean {
    const today = new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return (
      today.getFullYear() === y &&
      today.getMonth() === m - 1 &&
      today.getDate() === d
    );
  }

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const shiftsById: Record<string, Shift> = useMemo(() => {
    const map: Record<string, Shift> = {};
    (overview?.shifts ?? []).forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [overview?.shifts]);

  const datesInWeekSet = useMemo(() => new Set(weekDates), [weekDates]);
  const shiftIdsInWeek = useMemo(() => {
    const ids = new Set<string>();
    (overview?.shifts ?? []).forEach((s) => {
      if (
        datesInWeekSet.has(s.date) &&
        (!selectedBoardId || s.board_id === selectedBoardId)
      ) {
        ids.add(s.id);
      }
    });
    return ids;
  }, [overview?.shifts, datesInWeekSet, selectedBoardId]);
  const assignmentsInWeek = useMemo(
    () =>
      (overview?.assignments ?? []).filter((a) =>
        shiftIdsInWeek.has(a.shift_id)
      ),
    [overview?.assignments, shiftIdsInWeek]
  );
  const constraintsInWeek = useMemo(
    () =>
      (overview?.constraints ?? []).filter((c) => datesInWeekSet.has(c.date)),
    [overview?.constraints, datesInWeekSet]
  );

  const weeklyProgress = useMemo(() => {
    const datesSet = new Set(weekDates);
    let shiftsInWeek = (overview?.shifts ?? []).filter((s) =>
      datesSet.has(s.date)
    );
    if (selectedBoardId) {
      shiftsInWeek = shiftsInWeek.filter((s) => s.board_id === selectedBoardId);
    }
    const shiftIdsInWeek = new Set(shiftsInWeek.map((s) => s.id));
    const assignmentsInWeek = (overview?.assignments ?? []).filter((a) =>
      shiftIdsInWeek.has(a.shift_id)
    );
    const isFullDay = selectedBoard?.single_person_for_day ?? false;
    let daysFullyAssigned = 0;
    for (const date of weekDates) {
      const dayShifts = shiftsInWeek.filter((s) => s.date === date);
      const relevantShifts = isFullDay
        ? dayShifts.filter((s) => s.type === ShiftType.FullDay)
        : dayShifts.filter(
            (s) => s.type === ShiftType.Day || s.type === ShiftType.Night
          );
      if (relevantShifts.length === 0) continue;
      const allFull = relevantShifts.every((s) => {
        const count = assignmentsInWeek.filter(
          (a) => a.shift_id === s.id
        ).length;
        return count >= (s.required_count ?? 1);
      });
      if (allFull) daysFullyAssigned += 1;
    }
    return { daysFullyAssigned, total: 7 };
  }, [
    weekDates,
    selectedBoardId,
    selectedBoard?.single_person_for_day,
    overview?.shifts,
    overview?.assignments,
  ]);

  const handleAutofill = useCallback(async () => {
    if (!selectedBoardId || !weekDates.length) return;
    setError(null);
    setAutofillSuccess(null);
    setAutofillLoading(true);
    try {
      const fromDate = weekDates[0]!;
      const toDate = weekDates[6]!;
      const res = await apiFetch<{
        created: number;
        assignments: {
          id: string;
          shift_id: string;
          worker_id: string;
          created_at: string;
        }[];
      }>('/api/assignments/autofill', {
        method: 'POST',
        json: {
          board_id: selectedBoardId,
          from_date: fromDate,
          to_date: toDate,
        },
      });
      const created = res.assignments ?? [];
      if (created.length > 0) {
        updateOverview((prev) => ({
          ...prev,
          assignments: [...prev.assignments, ...created],
        }));
        setAutofillSuccess(`נוספו ${created.length} שיבוצים`);
        setTimeout(() => setAutofillSuccess(null), 4000);
      } else {
        setAutofillSuccess('אין משמרות ריקות לשיבוץ');
        setTimeout(() => setAutofillSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשיבוץ אוטומטי');
    } finally {
      setAutofillLoading(false);
    }
  }, [selectedBoardId, weekDates, updateOverview, setError]);

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

      {showCreateBoard && (
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
          <form
            onSubmit={handleCreateBoard}
            className="my-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              יצירת לוח שיבוצים חדש
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  שם הלוח
                </label>
                <input
                  type="text"
                  required
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="למשל: שגרה, מלחמה"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="singlePerson"
                  label="אדם יחיד לכל היום"
                  checked={newBoardSinglePerson}
                  onChange={(e) => {
                    setNewBoardSinglePerson(e.target.checked);
                    if (e.target.checked) setNewBoardWorkersPerShift(1);
                  }}
                />
              </div>
              {!newBoardSinglePerson && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    כמות כוננים במשמרת
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newBoardWorkersPerShift}
                    onChange={(e) =>
                      setNewBoardWorkersPerShift(
                        Math.max(1, parseInt(e.target.value, 10) || 1)
                      )
                    }
                    className="w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateBoard(false);
                  setNewBoardName('');
                  setNewBoardWorkersPerShift(1);
                  setNewBoardSinglePerson(false);
                }}
                className="cursor-pointer rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={creatingBoard || !newBoardName.trim()}
                className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingBoard ? 'יוצר…' : 'צור לוח'}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingConstraintConfirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
          <div className="my-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-base font-semibold text-zinc-800 dark:text-zinc-200">
              אילוץ בתאריך
            </h3>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              ל־{pendingConstraintConfirm.workerName} יש אילוץ באותו יום. אתה
              בטוח שאתה רוצה לשבץ אותו?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConstraintConfirm(null)}
                disabled={assigningFromConstraintModal}
                className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { shiftId, workerId } = pendingConstraintConfirm;
                  setAssigningFromConstraintModal(true);
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
                  } finally {
                    setAssigningFromConstraintModal(false);
                  }
                }}
                disabled={assigningFromConstraintModal}
                className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assigningFromConstraintModal ? 'טוען…' : 'כן, לשבץ'}
              </button>
            </div>
          </div>
        </div>
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
          {assigningCell && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="flex w-full max-w-sm flex-col rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-2">
                  <Dropdown
                    placeholder="בחירת כונן…"
                    value=""
                    onSelect={(workerId) => {
                      if (!workerId) return;
                      void ensureShiftAndAssign(
                        assigningCell.date,
                        assigningCell.type,
                        workerId
                      );
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
                  onClick={() => setAssigningCell(null)}
                  className="w-full cursor-pointer rounded-xl border border-zinc-300 py-2 text-sm dark:border-zinc-700"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {viewMode === 'list' && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            משמרות (יום + לילה)
          </h2>
          {shiftsAll.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              אין משמרות מוגדרות.
            </p>
          ) : (
            <div className="space-y-3">
              {shiftsAll.map((shift) => {
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
                      setShiftDrawer({
                        date: shift.date,
                        cellType,
                        shift,
                        assigns: shiftAssignments,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShiftDrawer({
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
                                    if (worker) setWorkerDrawer(worker);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (worker) setWorkerDrawer(worker);
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
                                      handleUnassign(a.id);
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
                            void handleAssign(shift, workerId);
                          }}
                          items={[
                            { value: '', label: 'בחירת כונן…' },
                            ...workersSorted.map((w) => {
                              const unavailable = hasUnavailableConstraint(
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
