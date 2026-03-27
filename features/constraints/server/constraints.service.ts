import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { ServiceError } from '@/lib/utils/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Constraint,
  ConstraintPostBody,
  ConstraintPatchBody,
} from '@/lib/utils/interfaces';
import { ConstraintStatus, ShiftType, canManage, Role } from '@/lib/utils/enums';

type Profile = {
  id: string;
  system_id: string | null;
  role: string;
  full_name?: string | null;
};

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function enrichWithWorkerNames(
  supabase: SupabaseClient,
  rows: Constraint[]
): Promise<Constraint[]> {
  const ownerIds = [...new Set(rows.map((c) => c.worker_id))].filter(Boolean);
  if (ownerIds.length === 0) return rows;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ownerIds);
  const names: Record<string, string | null> = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? null])
  );
  return rows.map((c) => ({
    ...c,
    worker_name: names[c.worker_id] ?? null,
  })) as Constraint[];
}

// ── GET ──

export async function getConstraints(params: {
  supabase: SupabaseClient;
  profile: Profile;
  allParam: string | null;
}) {
  const { supabase, profile, allParam } = params;
  const isManager = canManage(profile.role as Role);
  const managerWantsAll = isManager && allParam === '1';
  const systemId = profile.system_id;

  const systemProfileIdsResult = systemId
    ? await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('system_id', systemId)
        .neq('role', 'guest')
    : null;
  const systemProfileIds: string[] =
    systemProfileIdsResult?.data?.map((p) => p.id) ?? [];

  let query = supabase
    .from('constraints')
    .select('*')
    .order('date', { ascending: true })
    .order('type', { ascending: true });

  if (!managerWantsAll && !isManager) {
    query = query.eq('worker_id', profile.id);
  } else if (systemProfileIds.length > 0) {
    query = query.in('worker_id', systemProfileIds);
  } else if (systemId) {
    query = query.eq('worker_id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const constraints = await enrichWithWorkerNames(
    supabase,
    (data ?? []) as Constraint[]
  );

  const payload: {
    constraints: Constraint[];
    systemMembers?: { id: string; full_name: string | null }[];
  } = { constraints };

  if (managerWantsAll && systemProfileIdsResult?.data?.length) {
    payload.systemMembers = systemProfileIdsResult.data.map((p) => ({
      id: p.id,
      full_name: p.full_name ?? null,
    }));
  }

  return payload;
}

// ── CREATE (single / recurring / range) ──

export async function createConstraint(params: {
  supabase: SupabaseClient;
  profile: Profile;
  body: ConstraintPostBody;
}): Promise<{ single?: Constraint; created?: Constraint[] }> {
  const { supabase, profile, body } = params;

  const status: ConstraintStatus =
    body.status && Object.values(ConstraintStatus).includes(body.status)
      ? body.status
      : ConstraintStatus.Unavailable;

  if (body.range) {
    return createRangeConstraints(supabase, profile, body, status);
  }

  if (body.recurring) {
    return createRecurringConstraints(supabase, profile, body, status);
  }

  return createSingleConstraint(supabase, profile, body, status);
}

async function createRangeConstraints(
  supabase: SupabaseClient,
  profile: Profile,
  body: ConstraintPostBody,
  status: ConstraintStatus
): Promise<{ created: Constraint[] }> {
  const start = body.range_start_date;
  const end = body.range_end_date;
  const mode = body.range_type ?? 'day';
  if (!start || !end)
    throw new ServiceError(
      'Range requires range_start_date and range_end_date',
      400
    );

  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  if (startDate > endDate)
    throw new ServiceError(
      'range_start_date must be before or equal to range_end_date',
      400
    );

  const dates: string[] = [];
  const groupId = crypto.randomUUID();
  const cur = new Date(startDate);
  while (cur <= endDate) {
    dates.push(toYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const rows: Array<{
    worker_id: string;
    date: string;
    type: ShiftType;
    status: ConstraintStatus;
    note: string | null;
    recurring_group_id: string;
  }> = [];
  for (const date of dates) {
    const types: ShiftType[] =
      mode === 'both'
        ? [ShiftType.Day, ShiftType.Night]
        : [mode === 'night' ? ShiftType.Night : ShiftType.Day];
    for (const t of types) {
      rows.push({
        worker_id: profile.id,
        date,
        type: t,
        status,
        note: body.note ?? null,
        recurring_group_id: groupId,
      });
    }
  }

  const { data: created, error } = await supabase
    .from('constraints')
    .insert(rows)
    .select('*');

  if (error) {
    throw new Error(error.message ?? 'Failed to create constraint range');
  }

  const withNames = await enrichWithWorkerNames(supabase, (created ?? []) as Constraint[]);
  return { created: withNames };
}

async function createRecurringConstraints(
  supabase: SupabaseClient,
  profile: Profile,
  body: ConstraintPostBody,
  status: ConstraintStatus
): Promise<{ created: Constraint[] }> {
  const start = body.start_date;
  const dayOfWeek = body.day_of_week;
  if (!start || dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new ServiceError(
      'Recurring requires start_date and day_of_week (0–6)',
      400
    );
  }

  const groupId = crypto.randomUUID();
  const [sy, sm, sd] = start.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  let endDate: Date;
  if (body.end_date) {
    const [ey, em, ed] = body.end_date.split('-').map(Number);
    endDate = new Date(ey, em - 1, ed);
  } else {
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  const dates: string[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    if (cur.getDay() === dayOfWeek) dates.push(toYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const rows = dates.map((date) => ({
    worker_id: profile.id,
    date,
    type: body.type,
    status,
    note: body.note ?? null,
    recurring_group_id: groupId,
  }));

  const { data: created, error } = await supabase
    .from('constraints')
    .insert(rows)
    .select('*');

  if (error) {
    throw new Error(error.message ?? 'Failed to create constraint');
  }

  const withNames = await enrichWithWorkerNames(supabase, (created ?? []) as Constraint[]);
  return { created: withNames };
}

async function createSingleConstraint(
  supabase: SupabaseClient,
  profile: Profile,
  body: ConstraintPostBody,
  status: ConstraintStatus
): Promise<{ single: Constraint }> {
  if (!body.date || !body.type)
    throw new ServiceError('Missing date or type', 400);

  const { data, error } = await supabase
    .from('constraints')
    .insert({
      worker_id: profile.id,
      date: body.date,
      type: body.type,
      status,
      note: body.note ?? null,
    })
    .select('*')
    .single();

  if (error || !data)
    throw new Error(error?.message ?? 'Failed to create constraint');
  return { single: data as Constraint };
}

// ── UPDATE ──

export async function updateConstraint(params: {
  supabase: SupabaseClient;
  profileId: string;
  constraintId: string;
  body: ConstraintPatchBody;
}): Promise<Constraint> {
  const { supabase, profileId, constraintId, body } = params;

  const { data: existing, error: fetchError } = await supabase
    .from('constraints')
    .select('*')
    .eq('id', constraintId)
    .single();

  if (fetchError || !existing) throw new ServiceError('Not found', 404);
  if (existing.worker_id !== profileId)
    throw new ServiceError('Forbidden', 403);

  const update: Record<string, unknown> = {};
  if (body.date !== undefined) update.date = body.date;
  if (body.type !== undefined) update.type = body.type;
  if (body.status !== undefined) update.status = body.status;
  if (body.note !== undefined) update.note = body.note;

  const { data, error } = await supabase
    .from('constraints')
    .update(update)
    .eq('id', constraintId)
    .select('*')
    .single();

  if (error || !data)
    throw new Error(error?.message ?? 'Failed to update constraint');
  return data as Constraint;
}

// ── DELETE ──

export async function deleteConstraint(params: {
  supabase: SupabaseClient;
  profileId: string;
  constraintId: string;
  deleteSeries: boolean;
}): Promise<void> {
  const { supabase, profileId, constraintId, deleteSeries } = params;

  const { data: existing, error: fetchError } = await supabase
    .from('constraints')
    .select('id, worker_id, recurring_group_id')
    .eq('id', constraintId)
    .single();

  if (fetchError || !existing) throw new ServiceError('Not found', 404);
  if (existing.worker_id !== profileId)
    throw new ServiceError('Forbidden', 403);

  const admin = getSupabaseAdmin();

  if (
    deleteSeries &&
    (existing as { recurring_group_id?: string | null }).recurring_group_id
  ) {
    const groupId = (existing as { recurring_group_id: string })
      .recurring_group_id;
    const { data: toDelete, error: listErr } = await admin
      .from('constraints')
      .select('id')
      .eq('recurring_group_id', groupId)
      .eq('worker_id', profileId);
    if (listErr || !toDelete?.length) {
      throw new Error('Failed to find recurring constraints');
    }
    const ids = toDelete.map((r) => r.id);
    const { error } = await admin.from('constraints').delete().in('id', ids);
    if (error) {
      console.error('[DELETE constraints series]', error);
      throw new Error(error.message ?? 'Failed to delete constraints');
    }
    return;
  }

  const { error } = await admin
    .from('constraints')
    .delete()
    .eq('id', constraintId);
  if (error) {
    console.error('[DELETE constraint]', error);
    throw new Error(error.message ?? 'Failed to delete constraint');
  }
}

export { ServiceError } from '@/lib/utils/errors';
