import type { Worker } from '@/lib/utils/interfaces';
import { addDays } from '@/lib/assignments/autofill';

export const DAY_NAMES_HE = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
];

export const AVATAR_COLORS = [
  'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
  'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300',
  'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
  'bg-rose-500/20 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300',
  'bg-cyan-500/20 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-300',
];

export const WORKER_AVATAR_OVERRIDES: Record<string, string> = {
  'אור כהן': 'bg-red-500/20 text-red-700 dark:bg-red-500/25 dark:text-red-300',
};

export function getDatesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    if (cur === to) break;
    cur = addDays(cur, 1);
  }
  return out;
}

export function getWeekDates(offset: number): string[] {
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

export function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_NAMES_HE[date.getDay()] ?? '';
}

export function isDatePast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date < today;
}

export function isToday(dateStr: string): boolean {
  const today = new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return (
    today.getFullYear() === y &&
    today.getMonth() === m - 1 &&
    today.getDate() === d
  );
}

export function workerDisplayName(w: Worker | undefined): string {
  return w
    ? `${w.full_name ?? w.email ?? w.id ?? '—'}${w.is_reserves ? ' (מילואים)' : ''}`
    : '—';
}

export function getWorkerInitials(w: Worker | undefined): string {
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

export function getWorkerAvatarColor(
  workerId: string,
  worker?: Worker
): string {
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
