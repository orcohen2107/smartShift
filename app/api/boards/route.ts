import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { boardPostSchema } from '@/lib/utils/schemas/boards';
import type { ShiftBoard } from '@/lib/utils/interfaces';

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { profile } = res;
  const admin = getSupabaseAdmin();
  let query = admin
    .from('shift_boards')
    .select('*')
    .order('created_at', { ascending: true });
  if (profile.system_id) {
    query = query.eq('system_id', profile.system_id);
  } else {
    query = query.is('system_id', null);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch boards' },
      { status: 500 }
    );
  }

  return NextResponse.json({ boards: (data ?? []) as ShiftBoard[] });
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { profile } = res;
  const parsed = await parseBody(req, boardPostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const workersPerShift = body.workers_per_shift ?? 1;
  const singlePersonForDay = body.single_person_for_day ?? false;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('shift_boards')
    .insert({
      name: body.name.trim(),
      workers_per_shift: Math.max(1, workersPerShift),
      single_person_for_day: singlePersonForDay,
      created_by: profile.id,
      system_id: profile.system_id ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Failed to create board' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as ShiftBoard, { status: 201 });
}
