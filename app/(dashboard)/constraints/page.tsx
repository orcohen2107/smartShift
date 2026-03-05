"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import { useConstraints } from "@/contexts/ConstraintsContext";
import type { Constraint } from "@/lib/utils/interfaces";
import { ConstraintStatus, ShiftType } from "@/lib/utils/enums";

type ConstraintInput = {
  date: string;
  type: ShiftType;
  status: ConstraintStatus;
  note?: string;
};

function getCurrentWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const toInputDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  return {
    from: toInputDate(start),
    to: toInputDate(end),
  };
}

export default function ConstraintsPage() {
  const { constraints: items, setConstraints: setItems, loading, error, setError, load, hasCachedData } = useConstraints();

  const defaultRange = useMemo(() => getCurrentWeekRange(), []);
  const [fromDate, setFromDate] = useState<string>(defaultRange.from);
  const [toDate, setToDate] = useState<string>(defaultRange.to);

  const [form, setForm] = useState<ConstraintInput>({
    date: "",
    type: ShiftType.Day,
    status: ConstraintStatus.Unavailable,
    note: "",
  });

  // טעינה רק בכניסה ראשונה (אין cache)
  useEffect(() => {
    if (!hasCachedData) void load();
  }, []);

  const filteredItems = useMemo(
    () =>
      items.filter((c) => {
        if (fromDate && c.date < fromDate) return false;
        if (toDate && c.date > toDate) return false;
        return true;
      }),
    [items, fromDate, toDate],
  );

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
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create constraint");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiFetch<object>(`/api/constraints/${id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete constraint");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50";
  const labelClass = "block text-xs font-medium text-zinc-700 dark:text-zinc-300";

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
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          אילוצים
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          סימון ימים בהם אינך זמין למשמרות יום או לילה.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className={labelClass}>תאריך</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, date: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>סוג משמרת</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value as ShiftType,
                }))
              }
              className={inputClass}
            >
              <option value="day">משמרת יום</option>
              <option value="night">משמרת לילה</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>סטטוס</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as ConstraintStatus,
                }))
              }
              className={inputClass}
            >
              <option value={ConstraintStatus.Unavailable}>לא זמין</option>
              <option value={ConstraintStatus.Partial}>פנוי לכמה שעות</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-1">
            <label className={labelClass}>הערה (אופציונלי)</label>
            <input
              type="text"
              value={form.note ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, note: e.target.value }))
              }
              className={inputClass}
              placeholder="הערה קצרה..."
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400"
          >
            הוספת אילוץ
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            אילוצים (ברירת מחדל: השבוע הנוכחי)
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="space-y-1">
              <label className={labelClass}>מתאריך</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>עד תאריך</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            טוען אילוצים...
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            אין אילוצים לתאריכים שנבחרו.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/80">
            {filteredItems.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">
                    {c.date} · {c.type === ShiftType.Day ? "משמרת יום" : c.type === ShiftType.Night ? "משמרת לילה" : "כל היום"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        c.status === ConstraintStatus.Unavailable
                          ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100"
                      }`}
                    >
                      {c.status === ConstraintStatus.Unavailable
                        ? "לא זמין"
                        : "פנוי לכמה שעות"}
                    </span>
                    {c.note && (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {c.note}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  מחיקה
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </section>
    </div>
  );
}

