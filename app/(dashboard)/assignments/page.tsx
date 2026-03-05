"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import type {
  AssignmentsOverview,
  Constraint,
  Profile,
  Shift,
} from "@/lib/utils/interfaces";
import { ConstraintStatus, ShiftType } from "@/lib/utils/enums";

type CreateShiftInput = {
  date: string;
  type: ShiftType;
};

type AssignmentsGetResponse = AssignmentsOverview;

export default function AssignmentsPage() {
  const [type, setType] = useState<ShiftType>(ShiftType.Day);
  const [overview, setOverview] = useState<AssignmentsGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createShiftForm, setCreateShiftForm] = useState<CreateShiftInput>({
    date: "",
    type: ShiftType.Day,
  });
  const [initialWorkerId, setInitialWorkerId] = useState<string>("");

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<AssignmentsGetResponse>(
        `/api/assignments?type=${type}`,
      );
      setOverview(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const shiftsOfType: Shift[] = useMemo(
    () => overview?.shifts.filter((s) => s.type === type) ?? [],
    [overview, type],
  );

  const workersById: Record<string, Profile> = useMemo(() => {
    const map: Record<string, Profile> = {};
    overview?.workers.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [overview]);

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

  function hasUnavailableConstraint(
    workerId: string,
    date: string,
    shiftType: ShiftType,
  ) {
    const key = `${workerId}-${date}-${shiftType}`;
    return (constraintsByWorkerDateType[key] ?? []).some(
      (c) => c.status === ConstraintStatus.Unavailable,
    );
  }

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const createdShift = await apiFetch<Shift>("/api/shifts", {
        method: "POST",
        json: {
          date: createShiftForm.date,
          type: createShiftForm.type,
          // כרגע לא משתמשים בכמות נדרשת בבחירה, שולחים 1 כברירת מחדל
          required_count: 1,
        },
      });

      if (initialWorkerId) {
        await apiFetch("/api/assignments", {
          method: "POST",
          json: { shift_id: createdShift.id, worker_id: initialWorkerId },
        });
        setInitialWorkerId("");
      }

      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to create shift");
    }
  }

  async function handleAssign(shift: Shift, workerId: string) {
    setError(null);
    try {
      await apiFetch("/api/assignments", {
        method: "POST",
        json: { shift_id: shift.id, worker_id: workerId },
      });
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to assign worker");
    }
  }

  async function handleUnassign(assignmentId: string) {
    setError(null);
    try {
      await apiFetch("/api/assignments", {
        method: "DELETE",
        json: { assignment_id: assignmentId },
      });
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to remove assignment");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            שיבוצים
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ניהול משמרות ושיבוץ עובדים (שינויים — מנהל בלבד).
          </p>
        </div>
        <div className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 p-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900/80">
          {(["day", "night"] as ShiftType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1 ${
                type === t
                  ? "bg-emerald-500 text-emerald-950 shadow-sm"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t === "day" ? "יום" : "לילה"}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleCreateShift}
        className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          יצירת משמרת
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              תאריך
            </label>
            <input
              type="date"
              required
              value={createShiftForm.date}
              onChange={(e) =>
                setCreateShiftForm((prev) => ({
                  ...prev,
                  date: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            />
          </div>
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
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            >
              <option value="day">משמרת יום</option>
              <option value="night">משמרת לילה</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              שיבוץ ראשוני (אופציונלי)
            </label>
            <select
              value={initialWorkerId}
              onChange={(e) => setInitialWorkerId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            >
              <option value="">ללא שיבוץ התחלתי</option>
              {overview?.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name ?? w.email ?? w.id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          רק מנהלים יכולים ליצור או לערוך משמרות. עובדים יכולים לצפות בשיבוצים.
        </p>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400"
          >
            יצירת משמרת
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          משמרות ({type === "day" ? "יום" : "לילה"})
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">טוען...</p>
        ) : shiftsOfType.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            אין משמרות מוגדרות עבור סוג משמרת זה.
          </p>
        ) : (
          <div className="space-y-3">
            {shiftsOfType.map((shift) => {
              const shiftAssignments = getAssignmentsForShift(shift.id);
              return (
                <div
                  key={shift.id}
                  className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {shift.date} ·{" "}
                        {shift.type === "day" ? "יום" : "לילה"}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {shiftAssignments.length} עובדים שובצו למשמרת זו
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
                          עדיין אין עובדים שובצו למשמרת זו.
                        </p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {shiftAssignments.map((a) => {
                            const worker = workersById[a.worker_id];
                            const unavailable =
                              hasUnavailableConstraint(
                                a.worker_id,
                                shift.date,
                                shift.type,
                              );
                            return (
                              <li
                                key={a.id}
                                className="flex items-center justify-between rounded-xl bg-zinc-50 px-2 py-1 dark:bg-zinc-800/80"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                    {worker?.full_name ?? "עובד"}
                                  </span>
                                  {unavailable && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                      לא זמין
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnassign(a.id)}
                                  className="text-[11px] font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                                >
                                  הסרה
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        שיבוץ עובד נוסף
                      </div>
                      <select
                        onChange={(e) => {
                          const workerId = e.target.value;
                          if (!workerId) return;
                          void handleAssign(shift, workerId);
                          e.target.value = "";
                        }}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
                        defaultValue=""
                      >
                        <option value="">בחירת עובד…</option>
                        {overview?.workers.map((w) => {
                          const unavailable = hasUnavailableConstraint(
                            w.id,
                            shift.date,
                            shift.type,
                          );
                          return (
                            <option key={w.id} value={w.id}>
                              {w.full_name ?? w.id}
                              {unavailable ? " (לא זמין)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        אם עובד מסומן כלא זמין בתאריך וסוג משמרת זהה, תוצג כאן
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
    </div>
  );
}

