'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/apiFetch';
import Checkbox from '@/components/Checkbox';
import type { ShiftBoard, AssignmentsOverview } from '@/lib/utils/interfaces';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (board: ShiftBoard) => void;
};

export function CreateBoardModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [workersPerShift, setWorkersPerShift] = useState(1);
  const [singlePerson, setSinglePerson] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName('');
    setWorkersPerShift(1);
    setSinglePerson(false);
    setError(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const board = await apiFetch<ShiftBoard>('/api/boards', {
        method: 'POST',
        json: {
          name: name.trim(),
          workers_per_shift: workersPerShift,
          single_person_for_day: singlePerson,
        },
      });
      reset();
      onCreated(board);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
      <form
        onSubmit={handleSubmit}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: שגרה, מלחמה"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="singlePerson"
              label="אדם יחיד לכל היום"
              checked={singlePerson}
              onChange={(e) => {
                setSinglePerson(e.target.checked);
                if (e.target.checked) setWorkersPerShift(1);
              }}
            />
          </div>
          {!singlePerson && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                כמות כוננים במשמרת
              </label>
              <input
                type="number"
                min={1}
                value={workersPerShift}
                onChange={(e) =>
                  setWorkersPerShift(
                    Math.max(1, parseInt(e.target.value, 10) || 1)
                  )
                }
                className="w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
              />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="cursor-pointer rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'יוצר…' : 'צור לוח'}
          </button>
        </div>
      </form>
    </div>
  );
}
