import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import type { Constraint, ConstraintPostBody } from '@/lib/utils/interfaces';
import { ConstraintStatus, Role } from '@/lib/utils/enums';

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const url = new URL(req.url);
  const allParam = url.searchParams.get('all');
  const managerWantsAll = profile.role === Role.Manager && allParam === '1';

  // באילוצים worker_id = profile id (מזהה המשתמש שיצר את האילוץ)
  const systemId = profile.system_id;
  const systemProfileIdsResult = systemId
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('system_id', systemId)
    : null;
  const systemProfileIds: string[] =
    systemProfileIdsResult?.data?.map((p) => p.id) ?? [];

  let query = supabase
    .from('constraints')
    .select('*')
    .order('date', { ascending: true })
    .order('type', { ascending: true });

  if (!managerWantsAll && profile.role !== Role.Manager) {
    query = query.eq('worker_id', profile.id);
  } else if (systemProfileIds.length > 0) {
    query = query.in('worker_id', systemProfileIds);
  } else if (systemId) {
    query = query.eq('worker_id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as { worker_id: string; [k: string]: unknown }[];
  const ownerIds = [...new Set(rows.map((r) => r.worker_id))].filter(Boolean);

  let workerNames: Record<string, string | null> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds);
    workerNames = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name ?? null])
    );
  }

  const constraints: Constraint[] = rows.map((r) => ({
    ...r,
    worker_name: workerNames[r.worker_id] ?? null,
  })) as Constraint[];

  const payload: {
    constraints: Constraint[];
    systemMembers?: { id: string; full_name: string | null }[];
  } = {
    constraints,
  };
  if (managerWantsAll && systemProfileIdsResult?.data?.length) {
    payload.systemMembers = systemProfileIdsResult.data.map((p) => ({
      id: p.id,
      full_name: p.full_name ?? null,
    }));
  }

  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const body = (await req.json()) as ConstraintPostBody;

  const status: ConstraintStatus =
    body.status && Object.values(ConstraintStatus).includes(body.status)
      ? body.status
      : ConstraintStatus.Unavailable;

  if (body.recurring) {
    const start = body.start_date;
    const dayOfWeek = body.day_of_week;
    if (!start || dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json(
        { error: 'Recurring requires start_date and day_of_week (0–6)' },
        { status: 400 }
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
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dates: string[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      if (cur.getDay() === dayOfWeek) dates.push(toYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    const created: Constraint[] = [];
    for (const date of dates) {
      const { data, error } = await supabase
        .from('constraints')
        .insert({
          worker_id: profile.id,
          date,
          type: body.type,
          status,
          note: body.note ?? null,
          recurring_group_id: groupId,
        })
        .select('*')
        .single();
      if (error) {
        return NextResponse.json(
          { error: error?.message ?? 'Failed to create constraint' },
          { status: 500 }
        );
      }
      created.push(data as Constraint);
    }
    const ownerIds = [...new Set(created.map((c) => c.worker_id))];
    let workerNames: Record<string, string | null> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ownerIds);
      workerNames = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.full_name ?? null])
      );
    }
    const withNames = created.map((c) => ({
      ...c,
      worker_name: workerNames[c.worker_id] ?? null,
    })) as Constraint[];
    return NextResponse.json({ created: withNames }, { status: 201 });
  }

  if (!body.date || !body.type) {
    return NextResponse.json(
      { error: 'Missing date or type' },
      { status: 400 }
    );
  }

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

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create constraint' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as Constraint, { status: 201 });
}
