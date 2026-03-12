'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/apiFetch';
import type { Profile, System, Worker } from '@/lib/utils/interfaces';
import { Role } from '@/lib/utils/enums';

export default function SettingsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [newSystemName, setNewSystemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [addingSystem, setAddingSystem] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [deletingWorkerId, setDeletingWorkerId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ profiles: Profile[] }>('/api/profiles');
      setProfiles(data.profiles);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      if (msg.includes('Only managers') || msg.includes('403')) {
        router.replace('/dashboard');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadSystems = useCallback(async () => {
    try {
      const data = await fetch('/api/systems').then((r) => r.json());
      setSystems(data.systems ?? []);
    } catch {
      setSystems([]);
    }
  }, []);

  const loadWorkers = useCallback(async () => {
    try {
      const data = await apiFetch<{ workers: Worker[] }>('/api/workers');
      setWorkers(data.workers ?? []);
    } catch {
      setWorkers([]);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
    void loadSystems();
    void loadWorkers();
  }, [loadProfiles, loadSystems, loadWorkers]);

  async function handleAddSystem(e: FormEvent) {
    e.preventDefault();
    const name = newSystemName.trim();
    if (!name) return;
    setError(null);
    setAddingSystem(true);
    try {
      await apiFetch<System>('/api/systems', {
        method: 'POST',
        json: { name },
      });
      setNewSystemName('');
      await loadSystems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add system');
    } finally {
      setAddingSystem(false);
    }
  }

  async function handlePromote(id: string) {
    setError(null);
    setPromotingId(id);
    try {
      await apiFetch<{ profile: Profile }>(`/api/profiles/${id}/promote`, {
        method: 'POST',
      });
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, role: Role.Manager } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote');
    } finally {
      setPromotingId(null);
    }
  }

  async function handleDeleteWorker(id: string) {
    setError(null);
    setDeletingWorkerId(id);
    try {
      await apiFetch(`/api/workers/${id}`, { method: 'DELETE' });
      setWorkers((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete worker');
    } finally {
      setDeletingWorkerId(null);
    }
  }

  const unregisteredWorkers = workers.filter((w) => w.user_id == null);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          טוען הגדרות...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          הגדרות
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          הוספת מנהלים – כל מנהל יכול להוסיף מנהלים נוספים
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
          מערכות
        </h2>
        <div className="p-4">
          <form
            onSubmit={handleAddSystem}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={newSystemName}
              onChange={(e) => setNewSystemName(e.target.value)}
              placeholder="שם מערכת חדשה"
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 transition outline-none focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={addingSystem || !newSystemName.trim()}
              className="min-h-[44px] shrink-0 cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            >
              {addingSystem ? 'מוסיף...' : 'הוסף מערכת'}
            </button>
          </form>
          <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {systems.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
          כוננים שטרם נרשמו
        </h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {unregisteredWorkers.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              אין כוננים שטרם נרשמו.
            </li>
          ) : (
            unregisteredWorkers.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm sm:px-4"
              >
                <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {w.full_name ?? 'ללא שם'}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteWorker(w.id)}
                  disabled={deletingWorkerId === w.id}
                  className="min-h-[40px] shrink-0 cursor-pointer rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  {deletingWorkerId === w.id ? 'מוחק...' : 'מחק כונן'}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
          משתמשים ומנהלים
        </h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {p.full_name ?? p.email ?? 'ללא שם'}
                </span>
                {p.email && (
                  <span className="mr-2 text-zinc-500 dark:text-zinc-400">
                    ({p.email})
                  </span>
                )}
                {p.role === Role.Manager && (
                  <span className="mr-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                    מנהל
                  </span>
                )}
              </div>
              {p.role !== Role.Manager && (
                <button
                  type="button"
                  onClick={() => handlePromote(p.id)}
                  disabled={!!promotingId}
                  className="min-h-[40px] shrink-0 cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                >
                  {promotingId === p.id ? 'מעדכן...' : 'הפוך למנהל'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
