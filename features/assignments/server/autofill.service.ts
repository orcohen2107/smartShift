import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { assertBoardOwnership } from '@/lib/auth/assertOwnership';
import { computeAutofillProposals, addDays } from '@/lib/assignments/autofill';
import { getDatesInRange } from '@/features/assignments/utils';
import type {
  AutofillPreviewBody,
  AutofillApplyBody,
  AutofillProposalItem,
} from '@/features/assignments/types';

export async function previewAutofill(params: {
  body: AutofillPreviewBody;
  systemId: string | null;
}): Promise<{ proposed: AutofillProposalItem[] }> {
  const { body, systemId } = params;

  await assertBoardOwnership(body.board_id, systemId);

  const admin = getSupabaseAdmin();

  const fromDate = body.from_date;
  const toDate = body.to_date;
  const prevFrom = addDays(fromDate, -7);
  const prevTo = addDays(toDate, -7);

  const { data: board, error: boardErr } = await admin
    .from('shift_boards')
    .select('workers_per_shift, single_person_for_day')
    .eq('id', body.board_id)
    .single();

  if (boardErr || !board) {
    throw new Error(boardErr?.message ?? 'Board not found');
  }

  const workersPerShift = board.workers_per_shift ?? 1;
  const singlePersonForDay = board.single_person_for_day ?? false;

  const { data: shiftsData, error: shiftsErr } = await admin
    .from('shifts')
    .select('*')
    .eq('board_id', body.board_id)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });

  if (shiftsErr) {
    throw new Error(shiftsErr.message ?? 'Failed to fetch shifts');
  }

  const existingShifts = shiftsData ?? [];
  const existingByDateType = new Set(
    existingShifts.map((s) => `${s.date}:${s.type}`)
  );
  const weekDates = getDatesInRange(fromDate, toDate);
  const shiftTypes = singlePersonForDay ? ['full_day'] : ['day', 'night'];

  const virtualShifts: Array<{
    id: string;
    date: string;
    type: string;
    required_count: number;
  }> = [];
  for (const date of weekDates) {
    for (const type of shiftTypes) {
      const key = `${date}:${type}`;
      if (!existingByDateType.has(key)) {
        virtualShifts.push({
          id: key,
          date,
          type,
          required_count: workersPerShift,
        });
      }
    }
  }

  const shifts = [...existingShifts, ...virtualShifts].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.type).localeCompare(String(b.type))
  );

  const shiftIds = existingShifts.map((s) => s.id);

  const { data: assignments, error: assignErr } = await admin
    .from('assignments')
    .select('*')
    .in(
      'shift_id',
      shiftIds.length ? shiftIds : ['00000000-0000-0000-0000-000000000000']
    );

  if (assignErr) {
    throw new Error(assignErr.message);
  }

  const assignmentsList = assignments ?? [];

  let workersQuery = admin
    .from('workers')
    .select('*')
    .order('full_name', { ascending: true });
  if (systemId) {
    workersQuery = workersQuery.eq('system_id', systemId);
  } else {
    workersQuery = workersQuery.is('system_id', null);
  }
  const { data: workers, error: workersErr } = await workersQuery;

  if (workersErr || !workers) {
    throw new Error(workersErr?.message ?? 'Failed to fetch workers');
  }

  const workerUserIds = workers
    .map((w) => w.user_id)
    .filter(Boolean) as string[];
  let eligibleWorkers = workers;
  if (workerUserIds.length > 0) {
    const { data: guestProfiles } = await admin
      .from('profiles')
      .select('id')
      .in('id', workerUserIds)
      .eq('role', 'guest');
    const guestIds = new Set((guestProfiles ?? []).map((p) => p.id));
    eligibleWorkers = workers.filter(
      (w) => !w.user_id || !guestIds.has(w.user_id)
    );
  }

  const workerIds = new Set(eligibleWorkers.map((w) => w.id));

  const dates = Array.from(new Set(shifts.map((s) => s.date)));
  const { data: constraints, error: constraintsErr } = await admin
    .from('constraints')
    .select('*')
    .in('date', dates.length ? dates : ['1900-01-01'])
    .in('worker_id', workerIds.size ? Array.from(workerIds) : ['']);

  if (constraintsErr) {
    throw new Error(constraintsErr.message);
  }

  const constraintsList = constraints ?? [];

  const { data: prevShifts } = await admin
    .from('shifts')
    .select('id, date, type')
    .eq('board_id', body.board_id)
    .gte('date', prevFrom)
    .lte('date', prevTo);

  const prevShiftIds = (prevShifts ?? []).map((s) => s.id);
  const prevShiftById = new Map((prevShifts ?? []).map((s) => [s.id, s]));

  const lastWeekAssignments: {
    worker_id: string;
    date: string;
    type: string;
  }[] = [];

  if (prevShiftIds.length > 0) {
    const { data: prevAssigns } = await admin
      .from('assignments')
      .select('shift_id, worker_id')
      .in('shift_id', prevShiftIds);

    for (const a of prevAssigns ?? []) {
      const shift = prevShiftById.get(a.shift_id);
      if (shift && workerIds.has(a.worker_id)) {
        lastWeekAssignments.push({
          worker_id: a.worker_id,
          date: shift.date,
          type: shift.type,
        });
      }
    }
  }

  const proposedRaw = computeAutofillProposals({
    shifts,
    workers: eligibleWorkers,
    constraints: constraintsList,
    currentAssignments: assignmentsList.map((a) => ({
      shift_id: a.shift_id,
      worker_id: a.worker_id,
    })),
    lastWeekAssignments,
    workerIds,
  });

  const proposed: AutofillProposalItem[] = proposedRaw.map((p) => ({
    date: p.shift_date,
    type: p.shift_type,
    worker_id: p.worker_id,
    worker_name: p.worker_name,
  }));

  return { proposed };
}

export async function applyAutofill(params: {
  body: AutofillApplyBody;
  profileId: string;
  systemId: string | null;
}): Promise<{
  created: number;
  removed: number;
  assignments: Array<{ id: string; shift_id: string; worker_id: string }>;
}> {
  const { body, profileId, systemId } = params;
  const additions = body.additions ?? body.assignments ?? [];
  const removals = body.removals ?? [];

  await assertBoardOwnership(body.board_id, systemId);

  const admin = getSupabaseAdmin();

  const { data: board, error: boardErr } = await admin
    .from('shift_boards')
    .select('workers_per_shift, single_person_for_day')
    .eq('id', body.board_id)
    .single();

  if (boardErr || !board) {
    throw new Error(boardErr?.message ?? 'Board not found');
  }

  const workersPerShift = board.workers_per_shift ?? 1;

  const { data: existingShifts } = await admin
    .from('shifts')
    .select('id, date, type')
    .eq('board_id', body.board_id)
    .gte('date', body.from_date)
    .lte('date', body.to_date);

  const shiftByDateType = new Map<string, { id: string }>();
  for (const s of existingShifts ?? []) {
    shiftByDateType.set(`${s.date}:${s.type}`, { id: s.id });
  }

  const weekDates = getDatesInRange(body.from_date, body.to_date);
  const shiftTypes = board.single_person_for_day
    ? ['full_day']
    : ['day', 'night'];

  for (const date of weekDates) {
    for (const type of shiftTypes) {
      const key = `${date}:${type}`;
      if (shiftByDateType.has(key)) continue;

      const { data: newShift, error: insertErr } = await admin
        .from('shifts')
        .insert({
          date,
          type,
          board_id: body.board_id,
          created_by: profileId,
          required_count: workersPerShift,
        })
        .select('id')
        .single();

      if (!insertErr && newShift) {
        shiftByDateType.set(key, { id: newShift.id });
      }
    }
  }

  let removedCount = 0;
  for (const r of removals) {
    const shift = shiftByDateType.get(`${r.date}:${r.type}`);
    if (shift) {
      const { data: deleted } = await admin
        .from('assignments')
        .delete()
        .eq('shift_id', shift.id)
        .eq('worker_id', r.worker_id)
        .select('id');
      removedCount += deleted?.length ?? 0;
    }
  }

  const rows: { shift_id: string; worker_id: string }[] = [];
  for (const a of additions) {
    const shift = shiftByDateType.get(`${a.date}:${a.type}`);
    if (shift) {
      rows.push({ shift_id: shift.id, worker_id: a.worker_id });
    }
  }

  let inserted: { id: string; shift_id: string; worker_id: string }[] = [];
  if (rows.length > 0) {
    const { data, error } = await admin
      .from('assignments')
      .insert(rows)
      .select('id, shift_id, worker_id, created_at');

    if (error) {
      throw new Error(error.message ?? 'Failed to apply assignments');
    }
    inserted = data ?? [];
  }

  return {
    created: inserted.length,
    removed: removedCount,
    assignments: inserted,
  };
}
