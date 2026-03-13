import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';

type AutofillBody = {
  board_id: string;
  from_date: string; // yyyy-mm-dd
  to_date: string; // yyyy-mm-dd
};

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { profile } = res;
  const body = (await req.json()) as AutofillBody;

  if (!body.board_id || !body.from_date || !body.to_date) {
    return NextResponse.json(
      { error: 'Missing board_id, from_date or to_date' },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // שליפת משמרות של הלוח בטווח התאריכים
  const { data: shifts, error: shiftsErr } = await admin
    .from('shifts')
    .select('*')
    .eq('board_id', body.board_id)
    .gte('date', body.from_date)
    .lte('date', body.to_date)
    .order('date', { ascending: true });

  if (shiftsErr || !shifts) {
    return NextResponse.json(
      { error: shiftsErr?.message ?? 'Failed to fetch shifts' },
      { status: 500 }
    );
  }

  const shiftIds = shifts.map((s) => s.id);

  // שליפת שיבוצים קיימים
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

  // שליפת כוננים – רק אלו במערכת של המנהל
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

  // סינון אורחים
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

  // שליפת אילוצים
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

  // מפת: worker_id -> date -> Set<type> (אילוצים לא זמין)
  const constraintMap = new Map<string, Map<string, Set<string>>>();
  for (const c of constraintsList) {
    if (c.status !== 'unavailable') continue;
    if (!constraintMap.has(c.worker_id)) {
      constraintMap.set(c.worker_id, new Map());
    }
    const byDate = constraintMap.get(c.worker_id)!;
    if (!byDate.has(c.date)) byDate.set(c.date, new Set());
    byDate.get(c.date)!.add(c.type);
  }

  function hasUnavailableConstraint(
    workerId: string,
    date: string,
    shiftType: string
  ): boolean {
    const byDate = constraintMap.get(workerId);
    if (!byDate) return false;
    const types = byDate.get(date);
    if (!types) return false;
    if (shiftType === 'full_day') return types.size > 0;
    return types.has(shiftType);
  }

  // מפת: shift_id -> worker_ids (כבר שובצו)
  const assignedByShift = new Map<string, Set<string>>();
  for (const a of assignmentsList) {
    if (!workerIds.has(a.worker_id)) continue;
    if (!assignedByShift.has(a.shift_id)) {
      assignedByShift.set(a.shift_id, new Set());
    }
    assignedByShift.get(a.shift_id)!.add(a.worker_id);
  }

  // מפת: worker_id -> count (כמה שיבוצים השבוע)
  const workloadByWorker = new Map<string, number>();
  for (const a of assignmentsList) {
    if (!workerIds.has(a.worker_id)) continue;
    workloadByWorker.set(
      a.worker_id,
      (workloadByWorker.get(a.worker_id) ?? 0) + 1
    );
  }

  // מפת: worker_id -> Set<date> (באילו תאריכים כבר שובץ השבוע)
  const datesAssignedByWorker = new Map<string, Set<string>>();
  for (const a of assignmentsList) {
    if (!workerIds.has(a.worker_id)) continue;
    const shift = shifts.find((s) => s.id === a.shift_id);
    if (!shift) continue;
    if (!datesAssignedByWorker.has(a.worker_id)) {
      datesAssignedByWorker.set(a.worker_id, new Set());
    }
    datesAssignedByWorker.get(a.worker_id)!.add(shift.date);
  }

  const created: { id: string; shift_id: string; worker_id: string }[] = [];

  for (const shift of shifts) {
    const currentCount = assignedByShift.get(shift.id)?.size ?? 0;
    const required = shift.required_count ?? 1;
    const needed = Math.max(0, required - currentCount);

    for (let i = 0; i < needed; i++) {
      const shiftType = shift.type as string;

      // מיון כוננים: קודם בלי קונפליקט, בלי שיבוץ באותו יום, ואז לפי עומס נמוך
      const candidates = eligibleWorkers
        .filter((w) => {
          const alreadyInShift = assignedByShift.get(shift.id)?.has(w.id);
          if (alreadyInShift) return false;
          const alreadyThisDay =
            datesAssignedByWorker.get(w.id)?.has(shift.date) ?? false;
          if (alreadyThisDay) return false;
          return true;
        })
        .sort((a, b) => {
          const aConflict = hasUnavailableConstraint(
            a.id,
            shift.date,
            shiftType
          );
          const bConflict = hasUnavailableConstraint(
            b.id,
            shift.date,
            shiftType
          );
          if (aConflict !== bConflict) return aConflict ? 1 : -1;
          const aLoad = workloadByWorker.get(a.id) ?? 0;
          const bLoad = workloadByWorker.get(b.id) ?? 0;
          return aLoad - bLoad;
        });

      const chosen = candidates[0];
      if (!chosen) break;

      const { data: newAssign, error: insertErr } = await admin
        .from('assignments')
        .insert({ shift_id: shift.id, worker_id: chosen.id })
        .select('id, shift_id, worker_id, created_at')
        .single();

      if (insertErr || !newAssign) {
        console.error('[autofill] insert error', insertErr);
        continue;
      }

      created.push(
        newAssign as {
          id: string;
          shift_id: string;
          worker_id: string;
          created_at: string;
        }
      );
      if (!assignedByShift.has(shift.id)) {
        assignedByShift.set(shift.id, new Set());
      }
      assignedByShift.get(shift.id)!.add(chosen.id);
      workloadByWorker.set(
        chosen.id,
        (workloadByWorker.get(chosen.id) ?? 0) + 1
      );
      if (!datesAssignedByWorker.has(chosen.id)) {
        datesAssignedByWorker.set(chosen.id, new Set());
      }
      datesAssignedByWorker.get(chosen.id)!.add(shift.date);
    }
  }

  return NextResponse.json({
    created: created.length,
    assignments: created,
  });
}
