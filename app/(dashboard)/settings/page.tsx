'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cog6ToothIcon,
  TrashIcon,
  UserGroupIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/20/solid';
import { apiFetch } from '@/lib/api/apiFetch';
import type { Profile, System, Worker } from '@/lib/utils/interfaces';
import { canManage, Role } from '@/lib/utils/enums';

const ROLE_BADGE_CLASS: Record<Role, string> = {
  [Role.Manager]:
    'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
  [Role.Commander]:
    'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300',
  [Role.Worker]:
    'bg-zinc-500/20 text-zinc-700 dark:bg-zinc-500/25 dark:text-zinc-300',
  [Role.Guest]:
    'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
};

const ROLE_LABEL: Record<Role, string> = {
  [Role.Manager]: 'מנהל',
  [Role.Commander]: 'מפקד',
  [Role.Worker]: 'עובד',
  [Role.Guest]: 'אורח',
};

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
  const [userSearch, setUserSearch] = useState('');

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

  async function handlePromote(id: string, role: 'manager' | 'commander') {
    setError(null);
    setPromotingId(id);
    try {
      await apiFetch<{ profile: Profile }>(`/api/profiles/${id}/promote`, {
        method: 'POST',
        json: { role },
      });
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, role: role === 'manager' ? Role.Manager : Role.Commander }
            : p
        )
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

  const filteredProfiles = useMemo(() => {
    const list = profiles.filter((p) => p.role !== Role.Guest);
    if (!userSearch.trim()) return list;
    const q = userSearch.trim().toLowerCase();
    return list.filter(
      (p) =>
        (p.full_name ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q)
    );
  }, [profiles, userSearch]);

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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          הגדרות
        </h1>
        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
          הוספת מנהלים – כל מנהל יכול להוסיף מנהלים נוספים
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              מערכות
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            ניהול מערכות בארגון
          </p>
        </div>
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
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {systems.map((s) => (
              <li key={s.id} className="rounded-lg px-2 py-1">
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              כוננים
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            כוננים שטרם נרשמו במערכת
          </p>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {unregisteredWorkers.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              אין כוננים שטרם נרשמו.
            </li>
          ) : (
            unregisteredWorkers.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-white/5 sm:px-4 dark:hover:bg-white/[0.03]"
              >
                <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {w.full_name ?? 'ללא שם'}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteWorker(w.id)}
                  disabled={deletingWorkerId === w.id}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/15"
                  title="מחק כונן"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {deletingWorkerId === w.id ? 'מוחק…' : 'מחק'}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <UserCircleIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              משתמשים ומנהלים
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            ניהול הרשאות משתמשים
          </p>
        </div>
        <div className="p-3 sm:p-4">
          <div className="mb-3">
            <label className="sr-only" htmlFor="user-search">
              חיפוש משתמש
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="user-search"
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="חיפוש משתמש (שם או אימייל)"
                className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-white py-2 pr-10 pl-3 text-sm text-zinc-900 transition outline-none placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {filteredProfiles.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              {userSearch.trim() ? 'אין תוצאות לחיפוש' : 'אין משתמשים להצגה'}
            </li>
          ) : (
            filteredProfiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-white/5 sm:px-4 dark:hover:bg-white/[0.03]"
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
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE_CLASS[p.role]}`}
                  >
                    {ROLE_LABEL[p.role]}
                  </span>
                </div>
                {!canManage(p.role) && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handlePromote(p.id, 'manager')}
                      disabled={!!promotingId}
                      className="cursor-pointer rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/30 disabled:opacity-50 dark:bg-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-500/35"
                    >
                      {promotingId === p.id ? 'מעדכן…' : 'מנהל'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePromote(p.id, 'commander')}
                      disabled={!!promotingId}
                      className="cursor-pointer rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-500/30 disabled:opacity-50 dark:bg-indigo-500/25 dark:text-indigo-300 dark:hover:bg-indigo-500/35"
                    >
                      מפקד
                    </button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
