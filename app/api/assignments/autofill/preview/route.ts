import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { computeAutofillProposals, addDays } from '@/lib/assignments/autofill';

type AutofillPreviewBody = {
  board_id: string;
  from_date: string;
  to_date: string;
};

function getDatesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    if (cur === to) break;
    cur = addDays(cur, 1);
  }
  return out;
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { profile } = res;
  const body = (await req.json()) as AutofillPreviewBody;

  if (!body.board_id || !body.from_date || !body.to_date) {
    return NextResponse.json(
      { error: 'Missing board_id, from_date or to_date' },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      { error: boardErr?.message ?? 'Board not found' },
      { status: 500 }
    );
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

  const existingShifts = shiftsData ?? [];
  if (shiftsErr) {
    return NextResponse.json(
      { error: shiftsErr?.message ?? 'Failed to fetch shifts' },
      { status: 500 }
    );
  }

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
    return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  const assignmentsList = assignments ?? [];

  let workersQuery = admin
    .from('workers')
    .select('*')
    .order('full_name', { ascending: true });
  if (profile.system_id) {
    workersQuery = workersQuery.eq('system_id', profile.system_id);
  } else {
    workersQuery = workersQuery.is('system_id', null);
  }
  const { data: workers, error: workersErr } = await workersQuery;

  if (workersErr || !workers) {
    return NextResponse.json(
      { error: workersErr?.message ?? 'Failed to fetch workers' },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: constraintsErr.message },
      { status: 500 }
    );
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

  const proposed = proposedRaw.map((p) => ({
    date: p.shift_date,
    type: p.shift_type,
    worker_id: p.worker_id,
    worker_name: p.worker_name,
  }));

  return NextResponse.json({
    proposed,
  });
}
