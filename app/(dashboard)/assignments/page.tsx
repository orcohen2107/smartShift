"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import type {
  AssignmentsOverview,
  Constraint,
  Profile,
  Shift,
} from "@/lib/utils/interfaces";
import { ShiftType } from "@/lib/utils/enums";

type CreateShiftInput = {
  date: string;
  type: ShiftType;
  required_count: number;
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
    required_count: 1,
  });

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
    return (constraintsByWorkerDateType[key] ?? []).length > 0;
  }

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch<Shift>("/api/shifts", {
        method: "POST",
        json: createShiftForm,
      });
      setCreateShiftForm((prev) => ({
        ...prev,
        required_count: 1,
      }));
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
          <h1 className="text-lg font-semibold text-zinc-900">Assignments</h1>
          <p className="text-sm text-zinc-600">
            Manage shifts and assign workers. Manager-only for changes.
          </p>
        </div>
        <div className="inline-flex rounded-md border bg-white p-0.5 text-xs font-medium">
          {(["day", "night"] as ShiftType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded px-3 py-1 ${
                type === t
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {t === "day" ? "Day" : "Night"}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleCreateShift}
        className="space-y-3 rounded-lg border bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-zinc-800">Create shift</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Date
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
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Type
            </label>
            <select
              value={createShiftForm.type}
              onChange={(e) =>
                setCreateShiftForm((prev) => ({
                  ...prev,
                  type: e.target.value as ShiftType,
                }))
              }
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Required count
            </label>
            <input
              type="number"
              min={1}
              value={createShiftForm.required_count}
              onChange={(e) =>
                setCreateShiftForm((prev) => ({
                  ...prev,
                  required_count: Number(e.target.value || 1),
                }))
              }
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Only managers can create or modify shifts. Other users can still view
          the schedule.
        </p>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-zinc-800"
          >
            Create shift
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800">
          Shifts ({type === "day" ? "Day" : "Night"})
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : shiftsOfType.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No shifts defined yet for this type.
          </p>
        ) : (
          <div className="space-y-3">
            {shiftsOfType.map((shift) => {
              const shiftAssignments = getAssignmentsForShift(shift.id);
              return (
                <div
                  key={shift.id}
                  className="space-y-2 rounded-lg border bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {shift.date} ·{" "}
                        {shift.type === "day" ? "Day" : "Night"} · requires{" "}
                        {shift.required_count}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {shiftAssignments.length}/{shift.required_count} assigned
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700">
                        Assigned
                      </div>
                      {shiftAssignments.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          No workers assigned yet.
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
                                className="flex items-center justify-between rounded-md bg-zinc-50 px-2 py-1"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {worker?.full_name ?? "Worker"}
                                  </span>
                                  {unavailable && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                      Unavailable
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnassign(a.id)}
                                  className="text-[11px] font-medium text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-700">
                        Assign worker
                      </div>
                      <select
                        onChange={(e) => {
                          const workerId = e.target.value;
                          if (!workerId) return;
                          void handleAssign(shift, workerId);
                          e.target.value = "";
                        }}
                        className="w-full rounded-md border px-2 py-1.5 text-xs"
                        defaultValue=""
                      >
                        <option value="">Select worker…</option>
                        {overview?.workers.map((w) => {
                          const unavailable = hasUnavailableConstraint(
                            w.id,
                            shift.date,
                            shift.type,
                          );
                          return (
                            <option key={w.id} value={w.id}>
                              {w.full_name ?? w.id}
                              {unavailable ? " (unavailable)" : ""}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[11px] text-zinc-500">
                        Warnings are shown when a worker is marked as
                        unavailable for this date and shift. Assignments are not
                        blocked in the MVP.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

