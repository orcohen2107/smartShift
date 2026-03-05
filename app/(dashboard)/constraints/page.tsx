"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import type { Constraint } from "@/lib/utils/interfaces";
import { ConstraintStatus, ShiftType } from "@/lib/utils/enums";

type ConstraintInput = {
  date: string;
  type: ShiftType;
  status: ConstraintStatus;
  note?: string;
};

type ConstraintsResponse = {
  constraints: Constraint[];
};

export default function ConstraintsPage() {
  const [items, setItems] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ConstraintInput>({
    date: "",
    type: ShiftType.Day,
    status: ConstraintStatus.Unavailable,
    note: "",
  });

  async function load() {
    try {
      setError(null);
      setLoading(true);
      const data = await apiFetch<ConstraintsResponse>("/api/constraints");
      setItems(data.constraints);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load constraints");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch<Constraint>("/api/constraints", {
        method: "POST",
        json: form,
      });
      setForm((prev) => ({ ...prev, note: "" }));
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to create constraint");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiFetch<{}>(`/api/constraints/${id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to delete constraint");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Constraints</h1>
        <p className="text-sm text-zinc-600">
          Declare when you are unavailable for day or night shifts.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-lg border bg-white p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Date
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, date: e.target.value }))
              }
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-700">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({
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
              Status
            </label>
            <input
              value="unavailable"
              disabled
              className="w-full cursor-not-allowed rounded-md border bg-zinc-50 px-2 py-1.5 text-sm text-zinc-600"
            />
          </div>
          <div className="space-y-1 md:col-span-1">
            <label className="block text-xs font-medium text-zinc-700">
              Note (optional)
            </label>
            <input
              type="text"
              value={form.note ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, note: e.target.value }))
              }
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              placeholder="Short note..."
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-zinc-800"
          >
            Add constraint
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-800">My constraints</h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You have no constraints yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white">
            {items.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">
                    {c.date} · {c.type === "day" ? "Day" : "Night"}
                  </div>
                  {c.note && (
                    <div className="text-xs text-zinc-600">{c.note}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

