import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { ServiceError } from '@/lib/utils/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Worker } from '@/lib/utils/interfaces';

// ── List workers (excluding guest-linked) ──

export async function listWorkers(systemId: string | null): Promise<Worker[]> {
  const admin = getSupabaseAdmin();

  let query = admin
    .from('workers')
    .select('*')
    .order('full_name', { ascending: true });
  if (systemId) {
    query = query.eq('system_id', systemId);
  }
  const { data: workers, error } = await query;

  if (error) throw new Error(error.message);

  const list = (workers ?? []) as Worker[];

  const workerUserIds = list.map((w) => w.user_id).filter(Boolean) as string[];
  if (workerUserIds.length === 0) return list;

  const { data: guestProfiles } = await admin
    .from('profiles')
    .select('id')
    .in('id', workerUserIds)
    .eq('role', 'guest');

  const guestIds = new Set((guestProfiles ?? []).map((p) => p.id));
  return list.filter((w) => !w.user_id || !guestIds.has(w.user_id));
}

// ── Create worker ──

export async function createWorker(params: {
  supabase: SupabaseClient;
  fullName: string;
  systemId: string | null;
}): Promise<Worker> {
  const { supabase, fullName, systemId } = params;

  const { data, error } = await supabase
    .from('workers')
    .insert({
      full_name: fullName,
      email: null,
      user_id: null,
      system_id: systemId,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to add worker');
  }

  return data as Worker;
}

// ── Delete worker ──

export async function deleteWorker(params: {
  supabase: SupabaseClient;
  workerId: string;
  managerSystemId: string | null;
}): Promise<void> {
  const { supabase, workerId, managerSystemId } = params;

  const { data: worker, error: fetchError } = await supabase
    .from('workers')
    .select('id, user_id, system_id')
    .eq('id', workerId)
    .single();

  if (fetchError || !worker) {
    throw new ServiceError('Not found', 404);
  }

  if (managerSystemId && worker.system_id !== managerSystemId) {
    throw new ServiceError('Forbidden', 403);
  }

  if (worker.user_id != null) {
    throw new ServiceError('ניתן למחוק רק כונן שטרם נרשם למערכת', 400);
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('workers').delete().eq('id', workerId);

  if (error) {
    throw new Error(error.message ?? 'Failed to delete worker');
  }
}

export { ServiceError } from '@/lib/utils/errors';
