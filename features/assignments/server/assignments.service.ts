import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import {
  assertShiftOwnership,
  assertAssignmentOwnership,
} from '@/lib/auth/assertOwnership';
import { ServiceError } from '@/lib/utils/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Assignment,
  AssignmentsOverview,
  Constraint,
  Shift,
  ShiftBoard,
  Worker,
} from '@/lib/utils/interfaces';

type GetOverviewParams = {
  systemId: string | null;
  supabase: SupabaseClient;
  typeParam: string | null;
  boardId: string | null;
};

export async function getAssignmentsOverview(
  params: GetOverviewParams
): Promise<AssignmentsOverview> {
  const { systemId, supabase, typeParam, boardId } = params;

  const type =
    typeParam === 'day' || typeParam === 'night' || typeParam === 'full_day'
      ? typeParam
      : null;
  const allTypes = typeParam === 'all' || !typeParam;

  const admin = getSupabaseAdmin();

  // Phase 1: boards + workers in parallel (no deps between them)
  const [boards, allWorkers] = await Promise.all([
    fetchBoards(admin, systemId),
    fetchWorkers(admin, systemId),
  ]);

  const validBoardIds = boards.map((b) => b.id);

  // Phase 2: shifts + worker sync in parallel
  const [shifts, allWorkersSynced] = await Promise.all([
    fetchShifts(admin, {
      validBoardIds,
      type: allTypes ? null : type,
      boardId: boardId && validBoardIds.includes(boardId) ? boardId : null,
    }),
    syncAndFilterWorkers(admin, allWorkers, systemId),
  ]);

  const shiftIds = shifts.map((s) => s.id);
  const workerIds = allWorkersSynced.map((w) => w.id);
  const systemWorkerIds = new Set(workerIds);

  const dates = Array.from(new Set(shifts.map((s) => s.date)));
  const typesFilter = allTypes
    ? ['day', 'night', 'full_day']
    : type
      ? [type]
      : ['day', 'night', 'full_day'];

  // Phase 3: assignments + constraints in parallel
  const [rawAssignments, constraints] = await Promise.all([
    fetchAssignments(admin, shiftIds),
    fetchConstraints(supabase, { dates, typesFilter, workerIds }),
  ]);

  const assignments = rawAssignments.filter((a) =>
    systemWorkerIds.has(a.worker_id)
  );

  return {
    shifts: shifts as Shift[],
    assignments: assignments as Assignment[],
    workers: allWorkersSynced as Worker[],
    constraints: constraints as Constraint[],
    boards: boards as ShiftBoard[],
  };
}

export async function createAssignment(params: {
  shiftId: string;
  workerId: string;
  systemId: string | null;
  supabase: SupabaseClient;
}): Promise<Assignment> {
  const { shiftId, workerId, systemId, supabase } = params;

  await assertShiftOwnership(shiftId, systemId);

  const { data: worker } = await supabase
    .from('workers')
    .select('id')
    .eq('id', workerId)
    .eq('system_id', systemId ?? '')
    .single();
  if (!worker) {
    throw new ServiceError('Worker not in your system', 403);
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('assignments')
    .insert({ shift_id: shiftId, worker_id: workerId })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create assignment');
  }

  return data as Assignment;
}

export async function deleteAssignment(
  assignmentId: string,
  systemId: string | null
): Promise<void> {
  await assertAssignmentOwnership(assignmentId, systemId);

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) {
    throw new Error(error.message ?? 'Failed to delete assignment');
  }
}

export { ServiceError } from '@/lib/utils/errors';

// ── internal helpers ──

async function fetchShifts(
  admin: SupabaseClient,
  opts: {
    validBoardIds: string[];
    type: string | null;
    boardId: string | null;
  }
): Promise<Shift[]> {
  let query = admin
    .from('shifts')
    .select('*')
    .order('date', { ascending: true });

  if (opts.validBoardIds.length > 0) {
    query = query.in('board_id', opts.validBoardIds);
  } else {
    query = query.eq('board_id', '00000000-0000-0000-0000-000000000000');
  }
  if (opts.type) {
    query = query.eq('type', opts.type);
  }
  if (opts.boardId) {
    query = query.eq('board_id', opts.boardId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Shift[];
}

async function fetchAssignments(
  admin: SupabaseClient,
  shiftIds: string[]
): Promise<Assignment[]> {
  const { data, error } = await admin
    .from('assignments')
    .select('*')
    .in(
      'shift_id',
      shiftIds.length ? shiftIds : ['00000000-0000-0000-0000-000000000000']
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as Assignment[];
}

async function fetchWorkers(
  admin: SupabaseClient,
  systemId: string | null
): Promise<Worker[]> {
  let query = admin
    .from('workers')
    .select('*')
    .order('full_name', { ascending: true });
  if (systemId) {
    query = query.eq('system_id', systemId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Worker[];
}

async function syncAndFilterWorkers(
  admin: SupabaseClient,
  allWorkers: Worker[],
  systemId: string | null
): Promise<Worker[]> {
  const knownIds = new Set([
    ...allWorkers.map((w) => w.id),
    ...(allWorkers.map((w) => w.user_id).filter(Boolean) as string[]),
  ]);

  let profilesQuery = admin
    .from('profiles')
    .select('id, full_name, email, system_id, is_reserves, role')
    .in('role', ['manager', 'worker']);
  if (systemId) {
    profilesQuery = profilesQuery.eq('system_id', systemId);
  } else {
    profilesQuery = profilesQuery.is('system_id', null);
  }
  const { data: systemProfiles } = await profilesQuery;

  const toInsert = (systemProfiles ?? [])
    .filter((p) => !knownIds.has(p.id))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name ?? '',
      email: p.email ?? null,
      user_id: p.id,
      system_id: p.system_id ?? null,
      is_reserves: (p as { is_reserves?: boolean }).is_reserves ?? false,
    }));

  if (toInsert.length > 0) {
    await admin.from('workers').upsert(toInsert, { onConflict: 'id' });
  }

  // Re-fetch only if new workers were synced; otherwise reuse allWorkers
  let result: Worker[];
  if (toInsert.length > 0) {
    let q = admin
      .from('workers')
      .select('*')
      .order('full_name', { ascending: true });
    q = systemId ? q.eq('system_id', systemId) : q.is('system_id', null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    result = (data ?? []) as Worker[];
  } else {
    result = allWorkers;
  }

  const workerUserIds = result
    .map((w) => w.user_id)
    .filter(Boolean) as string[];
  if (workerUserIds.length > 0) {
    const { data: guestProfiles } = await admin
      .from('profiles')
      .select('id')
      .in('id', workerUserIds)
      .eq('role', 'guest');
    const guestIds = new Set((guestProfiles ?? []).map((p) => p.id));
    result = result.filter((w) => !w.user_id || !guestIds.has(w.user_id));
  }

  return result;
}

async function fetchConstraints(
  supabase: SupabaseClient,
  opts: {
    dates: string[];
    typesFilter: string[];
    workerIds: string[];
  }
): Promise<Constraint[]> {
  let query = supabase
    .from('constraints')
    .select('*')
    .in('date', opts.dates.length ? opts.dates : ['1900-01-01'])
    .in('type', opts.typesFilter);

  if (opts.workerIds.length > 0) {
    query = query.in('worker_id', opts.workerIds);
  } else {
    query = query.eq('worker_id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Constraint[];
}

async function fetchBoards(
  admin: SupabaseClient,
  systemId: string | null
): Promise<ShiftBoard[]> {
  let query = admin
    .from('shift_boards')
    .select('*')
    .order('created_at', { ascending: true });
  if (systemId) {
    query = query.eq('system_id', systemId);
  } else {
    query = query.is('system_id', null);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ShiftBoard[];
}
