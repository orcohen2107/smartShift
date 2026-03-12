"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import { useConstraints } from "@/contexts/ConstraintsContext";
import { useProfile } from "@/contexts/ProfileContext";
import Checkbox from "@/components/Checkbox";
import Dropdown from "@/components/Dropdown";
import type { Constraint } from "@/lib/utils/interfaces";
import { ConstraintStatus, Role, ShiftType } from "@/lib/utils/enums";

type ConstraintInput = {
  date: string;
  type: ShiftType;
  status: ConstraintStatus;
  note?: string;
};

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

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
  const profile = useProfile();
  const { constraints: items, setConstraints: setItems, systemMembers, loading, error, setError, load, hasCachedData } = useConstraints();

  const [mounted, setMounted] = useState(false);
  const defaultRange = useMemo(() => (mounted ? getCurrentWeekRange() : { from: "", to: "" }), [mounted]);
  const todayStr = useMemo(() => {
    if (!mounted) return "";
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, [mounted]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [filterWorkerId, setFilterWorkerId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteChoiceConstraint, setDeleteChoiceConstraint] = useState<Constraint | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {setMounted(true)}, []);
  useEffect(() => {
    if (mounted && defaultRange.from && defaultRange.to) {
      setFromDate(defaultRange.from);
      setToDate(defaultRange.to);
    }
  }, [mounted, defaultRange.from, defaultRange.to]);

  const [form, setForm] = useState<ConstraintInput>({
    date: "",
    type: ShiftType.Day,
    status: ConstraintStatus.Unavailable,
    note: "",
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDayOfWeek, setRecurringDayOfWeek] = useState(2); // שלישי
  const [recurringEndDate, setRecurringEndDate] = useState<string>("");

  // טעינה רק בכניסה ראשונה (אין cache) – מנהל מקבל אילוצים של כולם עם שמות
  useEffect(() => {
    if (hasCachedData || profile === null) return;
    void load(profile.role === Role.Manager ? { all: true } : undefined);
  }, [hasCachedData, profile]);

  const filteredItems = useMemo(
    () =>
      items.filter((c) => {
        if (fromDate && c.date < fromDate) return false;
        if (toDate && c.date > toDate) return false;
        if (filterWorkerId && c.worker_id !== filterWorkerId) return false;
        return true;
      }),
    [items, fromDate, toDate, filterWorkerId],
  );

  const filterOptions = useMemo(() => {
    if (systemMembers.length > 0) {
      return systemMembers
        .map((p) => ({ id: p.id, name: p.full_name ?? "ללא שם" }))
        .sort((a, b) => a.name.localeCompare(b.name, "he"));
    }
    const seen = new Set<string>();
    const opts: { id: string; name: string }[] = [];
    items.forEach((c) => {
      if (seen.has(c.worker_id)) return;
      seen.add(c.worker_id);
      opts.push({
        id: c.worker_id,
        name: c.worker_name ?? "ללא שם",
      });
    });
    opts.sort((a, b) => a.name.localeCompare(b.name, "he"));
    return opts;
  }, [items, systemMembers]);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsAdding(true);
    try {
      if (isRecurring) {
        const payload = {
          recurring: true,
          start_date: form.date,
          day_of_week: recurringDayOfWeek,
          end_date: recurringEndDate || null,
          type: form.type,
          status: form.status,
          note: form.note || undefined,
        };
        const res = await apiFetch<{ created: Constraint[] }>("/api/constraints", {
          method: "POST",
          json: payload,
        });
        const created = res.created ?? [];
        setForm((prev) => ({ ...prev, note: "" }));
        setItems((prev) => [
          ...prev,
          ...created.map((c) => ({
            ...c,
            worker_name: c.worker_name ?? profile?.full_name ?? null,
          })),
        ]);
        setSuccessMessage(
          created.length > 0
            ? `נוספו ${created.length} אילוצים מחזוריים`
            : "האילוץ נוסף בהצלחה",
        );
      } else {
        const created = await apiFetch<Constraint>("/api/constraints", {
          method: "POST",
          json: form,
        });
        setForm((prev) => ({ ...prev, note: "" }));
        setItems((prev) => [
          ...prev,
          { ...created, worker_name: created.worker_name ?? profile?.full_name ?? null },
        ]);
        setSuccessMessage("האילוץ נוסף בהצלחה");
      }
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create constraint");
    } finally {
      setIsAdding(false);
    }
  }, [form, isRecurring, recurringDayOfWeek, recurringEndDate, profile?.full_name, setItems, setError, setSuccessMessage]);

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    setSuccessMessage(null);
    setDeletingId(id);
    try {
      await apiFetch<object>(`/api/constraints/${id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((c) => c.id !== id));
      setSuccessMessage("האילוץ הוסר");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete constraint");
    } finally {
      setDeletingId(null);
    }
  }, [setItems, setError, setSuccessMessage]);

  const handleDeleteSeries = useCallback(async (id: string) => {
    setError(null);
    setSuccessMessage(null);
    setDeletingId(id);
    setDeleteChoiceConstraint(null);
    try {
      await apiFetch<object>(`/api/constraints/${id}?series=1`, {
        method: "DELETE",
      });
      const constraint = items.find((c) => c.id === id);
      const groupId = constraint?.recurring_group_id;
      if (groupId) {
        setItems((prev) => prev.filter((c) => c.recurring_group_id !== groupId));
      } else {
        setItems((prev) => prev.filter((c) => c.id !== id));
      }
      setSuccessMessage("כל המחזור הוסר");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete series");
    } finally {
      setDeletingId(null);
    }
  }, [items, setItems, setError, setSuccessMessage]);

  const handleDeleteClick = useCallback((c: Constraint) => {
    if (c.recurring_group_id) {
      setDeleteChoiceConstraint(c);
    } else {
      void handleDelete(c.id);
    }
  }, [handleDelete]);

  const inputClass =
    "cursor-pointer w-full min-h-[38px] min-w-0 rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:[color-scheme:dark] [color-scheme:light]";
  const dateInputClass =
    "cursor-pointer w-full min-h-[44px] min-w-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 pe-9 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 [color-scheme:light] dark:[color-scheme:dark]";
  const dateInputClassCompact =
    "cursor-pointer w-full min-h-[38px] min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 pe-8 text-xs text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 [color-scheme:light] dark:[color-scheme:dark] sm:min-h-[44px] sm:rounded-xl sm:px-3 sm:py-2 sm:pe-9 sm:text-sm";
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
      {deleteChoiceConstraint && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-choice-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-choice-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              למחוק אילוץ?
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              {formatDateHe(deleteChoiceConstraint.date)} · {deleteChoiceConstraint.type === ShiftType.Day ? "משמרת יום" : "משמרת לילה"}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleDelete(deleteChoiceConstraint.id);
                  setDeleteChoiceConstraint(null);
                }}
                disabled={deletingId === deleteChoiceConstraint.id}
                className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                מחיקה חד-פעמית (רק תאריך זה)
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSeries(deleteChoiceConstraint.id)}
                disabled={deletingId === deleteChoiceConstraint.id}
                className="cursor-pointer rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
              >
                מחיקת כל המחזור
              </button>
              <button
                type="button"
                onClick={() => setDeleteChoiceConstraint(null)}
                disabled={!!deletingId}
                className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                ביטול
              </button>
            </div>
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
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="flex items-center gap-2">
          <Checkbox
            id="recurring"
            label="מחזורי (לפי יום בשבוע)"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className={labelClass}>
              {isRecurring ? "תאריך התחלה" : "תאריך"}
            </label>
            <input
              type="date"
              required
              min={todayStr}
              value={form.date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, date: e.target.value }))
              }
              className={dateInputClass}
            />
          </div>
          {isRecurring && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>יום בשבוע</label>
                <Dropdown
                  value={String(recurringDayOfWeek)}
                  onSelect={(v) => setRecurringDayOfWeek(Number(v))}
                  items={DAY_NAMES_HE.map((name, i) => ({
                    value: String(i),
                    label: `כל ${name}`,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>תאריך סיום (אופציונלי)</label>
                <input
                  type="date"
                  min={form.date || todayStr}
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className={dateInputClass}
                  placeholder="אם ריק – שנה קדימה"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  אם לא בוחרים: אילוץ עד שנה מההתחלה
                </p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className={labelClass}>סוג משמרת</label>
            <Dropdown
              value={form.type}
              onSelect={(v) =>
                setForm((prev) => ({
                  ...prev,
                  type: v as ShiftType,
                }))
              }
              items={[
                { value: ShiftType.Day, label: "משמרת יום" },
                { value: ShiftType.Night, label: "משמרת לילה" },
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>סטטוס</label>
            <Dropdown
              value={form.status}
              onSelect={(v) =>
                setForm((prev) => ({
                  ...prev,
                  status: v as ConstraintStatus,
                }))
              }
              items={[
                { value: ConstraintStatus.Unavailable, label: "לא זמין" },
                { value: ConstraintStatus.Partial, label: "פנוי לכמה שעות" },
              ]}
            />
          </div>
          <div className="space-y-1 sm:col-span-2 md:col-span-1">
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
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {successMessage && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {successMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={isAdding}
            className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {isAdding ? "טוען..." : "הוספת אילוץ"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            אילוצים (ברירת מחדל: השבוע הנוכחי)
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {filterOptions.length > 0 && (
              <div className="space-y-1 col-span-2 md:col-span-1">
                <label className={labelClass}>פילטר לפי שם</label>
                <Dropdown
                  placeholder="הכל"
                  value={filterWorkerId}
                  onSelect={setFilterWorkerId}
                  items={[
                    { value: "", label: "הכל" },
                    ...filterOptions.map((o) => ({
                      value: o.id,
                      label: o.name,
                    })),
                  ]}
                />
              </div>
            )}
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>מתאריך</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={dateInputClassCompact}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className={labelClass}>עד תאריך</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={dateInputClassCompact}
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
            {filteredItems.map((c) => {
              const isOwner = profile?.id === c.worker_id;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-medium">
                      {formatDateHe(c.date)} · {c.type === ShiftType.Day ? "משמרת יום" : c.type === ShiftType.Night ? "משמרת לילה" : "כל היום"}
                      {c.worker_name && (
                        <span className="mr-2 text-zinc-500 dark:text-zinc-400">
                          · {c.worker_name}
                        </span>
                      )}
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
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(c)}
                      disabled={deletingId === c.id}
                      className="cursor-pointer shrink-0 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-60"
                    >
                      {deletingId === c.id ? "מסיר..." : "מחיקה"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </section>
    </div>
  );
}

