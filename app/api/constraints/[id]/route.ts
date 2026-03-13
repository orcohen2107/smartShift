import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import type { Constraint, ConstraintPatchBody } from '@/lib/utils/interfaces';
import { Role } from '@/lib/utils/enums';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  if (profile.role === Role.Guest) {
    return NextResponse.json(
      { error: 'Guests cannot edit constraints' },
      { status: 403 }
    );
  }
  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from('constraints')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // רק בעל האילוץ יכול לערוך
  if (existing.worker_id !== profile.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as ConstraintPatchBody;

  const update: Record<string, unknown> = {};
  if (body.date !== undefined) update.date = body.date;
  if (body.type !== undefined) update.type = body.type;
  if (body.status !== undefined) update.status = body.status;
  if (body.note !== undefined) update.note = body.note;

  const { data, error } = await supabase
    .from('constraints')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update constraint' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as Constraint);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  if (profile.role === Role.Guest) {
    return NextResponse.json(
      { error: 'Guests cannot delete constraints' },
      { status: 403 }
    );
  }
  const { id } = await params;
  const url = new URL(req.url);
  const deleteSeries = url.searchParams.get('series') === '1';

  const { data: existing, error: fetchError } = await supabase
    .from('constraints')
    .select('id, worker_id, recurring_group_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.worker_id !== profile.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
      .eq('worker_id', profile.id);
    if (listErr || !toDelete?.length) {
      return NextResponse.json(
        { error: 'Failed to find recurring constraints' },
        { status: 500 }
      );
    }
    const ids = toDelete.map((r) => r.id);
    const { error } = await admin.from('constraints').delete().in('id', ids);
    if (error) {
      console.error('[DELETE /api/constraints/[id] series]', error);
      return NextResponse.json(
        { error: error.message ?? 'Failed to delete constraints' },
        { status: 500 }
      );
    }
    return new Response(null, { status: 204 });
  }

  const { error } = await admin.from('constraints').delete().eq('id', id);

  if (error) {
    console.error('[DELETE /api/constraints/[id]]', error);
    return NextResponse.json(
      { error: error.message ?? 'Failed to delete constraint' },
      { status: 500 }
    );
  }

  return new Response(null, { status: 204 });
}
