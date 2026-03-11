"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/apiFetch";
import { useAssignments } from "@/contexts/AssignmentsContext";
import { useProfile } from "@/contexts/ProfileContext";
import type {
  Constraint,
  Shift,
  ShiftBoard,
  Worker,
} from "@/lib/utils/interfaces";
import { ConstraintStatus, Role, ShiftType } from "@/lib/utils/enums";
import Checkbox from "@/components/Checkbox";

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
  } = useAssignments();

  const profile = useProfile();
  const [mounted, setMounted] = useState(false);
  const todayStr = useMemo(() => {
    if (!mounted) return "";
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, [mounted]);
  const [createShiftForm, setCreateShiftForm] = useState<CreateShiftInput>({
    date: "",
    type: ShiftType.Day,
  });
  const [initialWorkerId, setInitialWorkerId] = useState<string>("");
  const [newWorkerName, setNewWorkerName] = useState("");
  const [addingWorker, setAddingWorker] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
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
  const [assigningFromConstraintModal, setAssigningFromConstraintModal] = useState(false);

  useEffect(() => {
    if (profile === null) return;
    if (profile.role !== Role.Manager) {
      router.replace("/dashboard");
    }
  }, [profile, router]);

  // טעינה מחדש בכל כניסה לדף – כדי לראות כוננים חדשים שהתחברו בלי ריענון ידני
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // סינון משמרות לפי לוח נבחר (client-side – אין בקשה נוספת)
  const shiftsFiltered: Shift[] = useMemo(() => {
    const shifts = overview?.shifts ?? [];
    if (!selectedBoardId) return shifts;
    return shifts.filter((s) => s.board_id === selectedBoardId);
  }, [overview?.shifts, selectedBoardId]);

  const shiftsAll: Shift[] = useMemo(
    () => shiftsFiltered,
    [shiftsFiltered],
  );

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
    const name = (w: Worker) => (w.full_name ?? w.email ?? w.id ?? "").trim();
    return list.sort((a, b) => {
      if (a.is_reserves !== b.is_reserves) return a.is_reserves ? 1 : -1;
      return name(a).localeCompare(name(b), "he");
    });
  }, [overview?.workers]);

  const workerDisplayName = (w: Worker | undefined) =>
    w ? `${w.full_name ?? w.email ?? w.id ?? "—"}${w.is_reserves ? " (מילואים)" : ""}` : "—";

  const constraintsByWorkerDateType: Record<string, Constraint[]> = useMemo(() => {
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

  /** בודק אם לעובד יש אילוץ בתאריך הנתון (כל סוג) */
  function hasConstraintForDate(workerId: string, date: string): boolean {
    return (overview?.constraints ?? []).some(
      (c) => c.worker_id === workerId && c.date === date,
    );
  }

  function hasUnavailableConstraint(
    profileId: string | null,
    date: string,
    shiftType: ShiftType,
  ) {
    if (!profileId) return false;
    const key = `${profileId}-${date}-${shiftType}`;
    return (constraintsByWorkerDateType[key] ?? []).some(
      (c) => c.status === ConstraintStatus.Unavailable,
    );
  }

  const selectedBoard = useMemo(
    () => overview?.boards?.find((b) => b.id === selectedBoardId) ?? null,
    [overview?.boards, selectedBoardId],
  );

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    setError(null);
    setCreatingBoard(true);
    try {
      const board = await apiFetch<ShiftBoard>("/api/boards", {
        method: "POST",
        json: {
          name: newBoardName.trim(),
          workers_per_shift: newBoardWorkersPerShift,
          single_person_for_day: newBoardSinglePerson,
        },
      });
      setNewBoardName("");
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
      setError(err instanceof Error ? err.message : "Failed to create board");
    } finally {
      setCreatingBoard(false);
    }
  }

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedBoardId || !selectedBoard) {
      setError("יש לבחור לוח שיבוצים לפני יצירת משמרת");
      return;
    }
    setCreatingShift(true);
    try {
      const type = selectedBoard.single_person_for_day
        ? ShiftType.FullDay
        : createShiftForm.type;
      const requiredCount =
        createShiftForm.required_count ?? selectedBoard.workers_per_shift ?? 1;
      const createdShift = await apiFetch<Shift>("/api/shifts", {
        method: "POST",
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

      let assignment: { id: string; shift_id: string; worker_id: string; created_at: string } | null = null;
      if (initialWorkerId) {
        const workerName = workersById[initialWorkerId]?.full_name ?? workersById[initialWorkerId]?.email ?? "העובד";
        if (hasConstraintForDate(initialWorkerId, createShiftForm.date)) {
          setPendingConstraintConfirm({
            shiftId: createdShift.id,
            workerId: initialWorkerId,
            workerName,
          });
          setInitialWorkerId("");
        } else {
          assignment = await apiFetch("/api/assignments", {
            method: "POST",
            json: { shift_id: createdShift.id, worker_id: initialWorkerId },
          });
          setInitialWorkerId("");
          updateOverview((prev) => ({
            ...prev,
            assignments: [...prev.assignments, assignment!],
          }));
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create shift");
    } finally {
      setCreatingShift(false);
    }
  }

  async function doAssign(shiftId: string, workerId: string) {
    const assignment = await apiFetch<{ id: string; shift_id: string; worker_id: string; created_at: string }>("/api/assignments", {
      method: "POST",
      json: { shift_id: shiftId, worker_id: workerId },
    });
    updateOverview((prev) => ({
      ...prev,
      assignments: [...prev.assignments, assignment],
    }));
  }

  async function handleAssign(shift: Shift, workerId: string) {
    setError(null);
    const workerName = workersById[workerId]?.full_name ?? workersById[workerId]?.email ?? "העובד";
    if (hasConstraintForDate(workerId, shift.date)) {
      setPendingConstraintConfirm({ shiftId: shift.id, workerId, workerName });
      return;
    }
    try {
      await doAssign(shift.id, workerId);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to assign worker");
    }
  }

  async function handleUnassign(assignmentId: string) {
    setError(null);
    setUnassigningId(assignmentId);
    try {
      await apiFetch(
        `/api/assignments?assignment_id=${encodeURIComponent(assignmentId)}`,
        { method: "DELETE" },
      );
      updateOverview((prev) => ({
        ...prev,
        assignments: prev.assignments.filter((a) => a.id !== assignmentId),
      }));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to remove assignment");
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
      const worker = await apiFetch<Worker>("/api/workers", {
        method: "POST",
        json: { full_name: newWorkerName.trim() },
      });
      setNewWorkerName("");
      updateOverview((prev) => ({
        ...prev,
        workers: [...prev.workers, worker],
      }));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to add worker");
    } finally {
      setAddingWorker(false);
    }
  }

  function getShiftByDateType(date: string, t: ShiftType): Shift | undefined {
    return shiftsFiltered.find((s) => s.date === date && s.type === t);
  }

  async function ensureShiftAndAssign(date: string, shiftType: ShiftType, workerId: string) {
    setAssigningCell(null);
    setError(null);
    if (!selectedBoardId || !selectedBoard) {
      setError("יש לבחור לוח שיבוצים לפני שיבוץ");
      return;
    }
    setAssigningCellKey(`${date}-${shiftType}-${workerId}`);
    try {
      const type =
        selectedBoard.single_person_for_day ? ShiftType.FullDay : shiftType;
      let shift = getShiftByDateType(date, type);
      if (!shift) {
        shift = await apiFetch<Shift>("/api/shifts", {
          method: "POST",
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
      const workerName = workersById[workerId]?.full_name ?? workersById[workerId]?.email ?? "העובד";
      if (hasConstraintForDate(workerId, date)) {
        setAssigningCellKey(null);
        setPendingConstraintConfirm({ shiftId: shift.id, workerId, workerName });
        return;
      }
      await doAssign(shift.id, workerId);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to assign");
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
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
    return out;
  }

  const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  function formatDateHe(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
  }

  function getDayName(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return DAY_NAMES_HE[date.getDay()] ?? "";
  }

  function isDatePast(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date < today;
  }

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  if (profile === null || profile.role !== Role.Manager) {
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
          <p>{loading ? "טוען..." : "שגיאה בטעינה"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {loading && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">טוען נתונים...</p>
          </div>
        </div>
      )}

      {showCreateBoard && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateBoard}
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 my-auto"
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
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
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
                      setNewBoardWorkersPerShift(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="cursor-pointer w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateBoard(false);
                  setNewBoardName("");
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
                className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingBoard ? "יוצר…" : "צור לוח"}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingConstraintConfirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 my-auto">
            <h3 className="mb-3 text-base font-semibold text-zinc-800 dark:text-zinc-200">
              אילוץ בתאריך
            </h3>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              ל־{pendingConstraintConfirm.workerName} יש אילוץ באותו יום. אתה בטוח שאתה רוצה לשבץ אותו?
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
                    setError(err instanceof Error ? err.message : "Failed to assign worker");
                  } finally {
                    setAssigningFromConstraintModal(false);
                  }
                }}
                disabled={assigningFromConstraintModal}
                className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assigningFromConstraintModal ? "טוען…" : "כן, לשבץ"}
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
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="רענן נתונים"
          >
            רענן
          </button>
          <div className="flex items-center gap-2">
            <select
              value={selectedBoardId ?? ""}
              onChange={(e) =>
                setSelectedBoardId(e.target.value || null)
              }
              className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            >
              <option value="">כל הלוחות</option>
              {overview?.boards?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.single_person_for_day ? " (אדם יחיד)" : ` (${b.workers_per_shift} במשמרת)`}
                </option>
              ))}
            </select>
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
              onClick={() => setViewMode("list")}
              className={`cursor-pointer rounded-full px-3 py-1 ${viewMode === "list" ? "bg-emerald-500 text-emerald-950 shadow-sm" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            >
              רשימה
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`cursor-pointer rounded-full px-3 py-1 ${viewMode === "calendar" ? "bg-emerald-500 text-emerald-950 shadow-sm" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
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
        <div className="space-y-1 min-w-[180px]">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            הוספת כונן לרשימת הכוננים (לפני הרשמה)
          </label>
          <input  
            type="text"
            value={newWorkerName}
            onChange={(e) => setNewWorkerName(e.target.value)}
            placeholder="שם מלא"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={addingWorker || !newWorkerName.trim()}
          className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addingWorker ? "מוסיף…" : "הוסף לרשימה"}
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
              className="cursor-pointer w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:[color-scheme:dark]"
            />
          </div>
          {!selectedBoard?.single_person_for_day && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                סוג משמרת
              </label>
              <select
                value={createShiftForm.type}
                onChange={(e) =>
                  setCreateShiftForm((prev) => ({
                    ...prev,
                    type: e.target.value as ShiftType,
                  }))
                }
                className="cursor-pointer w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
              >
                <option value="day">משמרת יום</option>
                <option value="night">משמרת לילה</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              שיבוץ ראשוני (אופציונלי)
            </label>
            <select
              value={initialWorkerId}
              onChange={(e) => setInitialWorkerId(e.target.value)}
              className="cursor-pointer w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            >
              <option value="">ללא שיבוץ התחלתי</option>
              {workersSorted.map((w) => (
                <option key={w.id} value={w.id}>
                  {workerDisplayName(w)}
                  {!w.user_id ? " (טרם נרשם)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          רק מנהלים יכולים ליצור או לערוך משמרות. כוננים יכולים לצפות בשיבוצים.
          {!selectedBoard && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              יש לבחור לוח שיבוצים כדי ליצור משמרת חדשה.
            </span>
          )}
        </p>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedBoard || creatingShift}
            className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingShift ? "יוצר…" : "יצירת משמרת"}
          </button>
        </div>
      </form>

      {viewMode === "calendar" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              לוח שבועי
            </h2>
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
                {weekDates[0] && formatDateHe(weekDates[0])} – {weekDates[6] && formatDateHe(weekDates[6])}
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
          <div className="overflow-x-auto -mx-3 sm:mx-0 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
              <table className="w-full min-w-[480px] sm:min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">תאריך</th>
                    {selectedBoard?.single_person_for_day ? (
                      <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">כל היום</th>
                    ) : (
                      <>
                        <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">משמרת יום</th>
                        <th className="p-2 text-right text-zinc-600 dark:text-zinc-400">משמרת לילה</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {weekDates.map((date) => {
                    const isFullDay = selectedBoard?.single_person_for_day ?? false;
                    const shiftDay = getShiftByDateType(date, ShiftType.Day);
                    const shiftNight = getShiftByDateType(date, ShiftType.Night);
                    const shiftFullDay = getShiftByDateType(date, ShiftType.FullDay);
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
                      assigns: { id: string; worker_id: string }[],
                      cellType: ShiftType,
                    ) => {
                      const isAssigningHere = assigningCellKey?.startsWith(`${date}-${cellType}-`);
                      return (
                      <td className="p-2 align-top" key={String(cellType)}>
                        <div
                          className={`min-h-[44px] rounded-lg border border-dashed p-2 dark:border-zinc-700 ${
                            !shift && isPast
                              ? "border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50"
                              : "border-zinc-200 dark:border-zinc-700"
                          } ${!shift && isPast ? "opacity-60" : ""}`}
                        >
                          {isAssigningHere && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">משבץ…</span>
                          )}
                          {assigns.map((a) => {
                            const w = workersById[a.worker_id];
                            const hasConstraint = shift && hasConstraintForDate(a.worker_id, shift.date);
                            return (
                              <div
                                key={a.id}
                                className="flex items-center justify-between gap-1 text-xs"
                              >
                                <span className="inline-flex items-center gap-1">
                                  {workerDisplayName(w)}
                                  {hasConstraint && (
                                    <span
                                      className="inline-flex shrink-0 text-amber-500"
                                      title="קיים אילוץ בתאריך זה"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                      </svg>
                                    </span>
                                  )}
                                </span>
                                {canEdit && shift && (
                                  <button
                                    type="button"
                                    onClick={() => handleUnassign(a.id)}
                                    disabled={unassigningId === a.id}
                                    className="cursor-pointer text-red-500 hover:underline disabled:opacity-50"
                                  >
                                    {unassigningId === a.id ? "מסיר…" : "הסר"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {canEdit && !isAssigningHere && (
                            <button
                              type="button"
                              onClick={() =>
                                setAssigningCell({
                                  date,
                                  type: cellType,
                                  shiftId: shift?.id ?? null,
                                })
                              }
                              className="cursor-pointer mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                            >
                              + שבץ כונן
                            </button>
                          )}
                          {!shift && isPast && !isAssigningHere && (
                            <span className="mt-1 text-xs text-zinc-400">—</span>
                          )}
                        </div>
                      </td>
                    );
                    };

                    return (
                      <tr
                        key={date}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="p-2 font-medium text-zinc-900 dark:text-zinc-100">
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {getDayName(date)}
                          </span>{" "}
                          {formatDateHe(date)}
                        </td>
                        {isFullDay ? (
                          renderCell(shiftForDay, assignDay, ShiftType.FullDay)
                        ) : (
                          <>
                            {renderCell(shiftForDay, assignDay, ShiftType.Day)}
                            {renderCell(shiftForNight, assignNight, ShiftType.Night)}
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          {assigningCell && (
            <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">
                  שיבוץ ל־{formatDateHe(assigningCell.date)} –{" "}
                  {assigningCell.type === "full_day"
                    ? "כל היום"
                    : assigningCell.type === "day"
                      ? "יום"
                      : "לילה"}
                </p>
                <select
                  className="cursor-pointer mb-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
                  onChange={(e) => {
                    const workerId = e.target.value;
                    if (!workerId) return;
                    void ensureShiftAndAssign(
                      assigningCell.date,
                      assigningCell.type,
                      workerId,
                    );
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="">בחירת כונן…</option>
                  {workersSorted.map((w) => (
                    <option key={w.id} value={w.id}>
                      {workerDisplayName(w)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAssigningCell(null)}
                  className="cursor-pointer w-full rounded-xl border border-zinc-300 py-2 text-sm dark:border-zinc-700"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {viewMode === "list" && (
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
              return (
                <div
                  key={shift.id}
                  className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatDateHe(shift.date)} ·{" "}
                        {shift.type === "full_day"
                          ? "כל היום"
                          : shift.type === "day"
                            ? "יום"
                            : "לילה"}
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
                            const hasConstraint = hasConstraintForDate(a.worker_id, shift.date);
                            const unavailable = hasUnavailableConstraint(
                              worker?.user_id ?? null,
                              shift.date,
                              shift.type,
                            );
                            return (
                              <li
                                key={a.id}
                                className="flex items-center justify-between rounded-xl bg-zinc-50 px-2 py-1 dark:bg-zinc-800/80"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-100">
                                    {workerDisplayName(worker)}
                                    {hasConstraint && (
                                      <span
                                        className="inline-flex shrink-0 text-amber-500"
                                        title="קיים אילוץ בתאריך זה"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                                          <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                    )}
                                  </span>
                                  {worker && !worker.user_id && (
                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                      (טרם נרשם)
                                    </span>
                                  )}
                                  {unavailable && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                      לא זמין
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnassign(a.id)}
                                  disabled={unassigningId === a.id}
                                  className="cursor-pointer text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
                                >
                                  {unassigningId === a.id ? "מסיר…" : "הסרה"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        שיבוץ כונן נוסף
                      </div>
                      <select
                        onChange={(e) => {
                          const workerId = e.target.value;
                          if (!workerId) return;
                          void handleAssign(shift, workerId);
                          e.target.value = "";
                        }}
                        className="cursor-pointer w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
                        defaultValue=""
                      >
                        <option value="">בחירת כונן…</option>
                        {workersSorted.map((w) => {
                          const unavailable = hasUnavailableConstraint(
                            w.user_id ?? null,
                            shift.date,
                            shift.type,
                          );
                          return (
                            <option key={w.id} value={w.id}>
                              {workerDisplayName(w)}
                              {!w.user_id ? " (טרם נרשם)" : ""}
                              {unavailable ? " (לא זמין)" : ""}
                            </option>
                          );
                        })}
                      </select>
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
    </div>
  );
}

