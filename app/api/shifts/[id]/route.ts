import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { parseBody, parseUuidParam } from '@/lib/utils/schemas/parseBody';
import { shiftPatchSchema } from '@/lib/utils/schemas/shifts';
import type { Shift } from '@/lib/utils/interfaces';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const { id } = await params;

  if (!parseUuidParam(id)) {
    return NextResponse.json({ error: 'Invalid shift id' }, { status: 400 });
  }

  const parsed = await parseBody(req, shiftPatchSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const update: Record<string, unknown> = {};
  if (body.date !== undefined) update.date = body.date;
  if (body.type !== undefined) update.type = body.type;
  if (body.required_count !== undefined)
    update.required_count = body.required_count;

  const { data, error } = await supabase
    .from('shifts')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as Shift);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const { id } = await params;

  if (!parseUuidParam(id)) {
    return NextResponse.json({ error: 'Invalid shift id' }, { status: 400 });
  }

  const { error } = await supabase.from('shifts').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    );
  }

  return NextResponse.json({}, { status: 204 });
}
