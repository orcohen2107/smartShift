import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { assertBoardOwnership } from '@/lib/auth/assertOwnership';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { shiftPostSchema } from '@/lib/utils/schemas/shifts';
import type { Shift } from '@/lib/utils/interfaces';
import type { ShiftType } from '@/lib/utils/enums';

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const url = new URL(req.url);
  const type = url.searchParams.get('type') as ShiftType | null;

  let query = supabase
    .from('shifts')
    .select('*')
    .order('date', { ascending: true });

  if (type === 'day' || type === 'night' || type === 'full_day') {
    query = query.eq('type', type);
  }

  const boardId = url.searchParams.get('board_id');
  if (boardId) {
    query = query.eq('board_id', boardId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    );
  }

  return NextResponse.json({ shifts: (data ?? []) as Shift[] });
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { profile } = res;
  const parsed = await parseBody(req, shiftPostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.board_id) {
    try {
      await assertBoardOwnership(body.board_id, profile.system_id);
    } catch {
      return NextResponse.json(
        { error: 'You do not have permission to access this board' },
        { status: 403 }
      );
    }
  }

  const insertPayload: Record<string, unknown> = {
    date: body.date,
    type: body.type,
    created_by: profile.id,
    required_count: body.required_count ?? 1,
  };
  if (body.board_id) {
    insertPayload.board_id = body.board_id;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('shifts')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as Shift, { status: 201 });
}
