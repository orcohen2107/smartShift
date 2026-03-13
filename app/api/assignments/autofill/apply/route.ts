import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { addDays } from '@/lib/assignments/autofill';

type ApplyAssignment = {
  date: string;
  type: string;
  worker_id: string;
};

type ApplyBody = {
  board_id: string;
  from_date: string;
  to_date: string;
  additions?: ApplyAssignment[];
  removals?: ApplyAssignment[];
  /** @deprecated use additions */
  assignments?: ApplyAssignment[];
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
  const body = (await req.json()) as ApplyBody;

  const additions = body.additions ?? body.assignments ?? [];
  const removals = body.removals ?? [];

  if (
    !body.board_id ||
    !body.from_date ||
    !body.to_date ||
    (additions.length === 0 && removals.length === 0)
  ) {
    return NextResponse.json(
      { error: 'Missing board_id, from_date, to_date or assignments' },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

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
          created_by: profile.id,
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
      console.error('[autofill/apply] insert error', error);
      return NextResponse.json(
        { error: error.message ?? 'Failed to apply assignments' },
        { status: 500 }
      );
    }
    inserted = data ?? [];
  }

  return NextResponse.json({
    created: inserted.length,
    removed: removedCount,
    assignments: inserted,
  });
}
