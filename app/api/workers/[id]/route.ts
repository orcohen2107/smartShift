import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { parseUuidParam } from '@/lib/utils/schemas/parseBody';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';
import { deleteWorker } from '@/features/workers/server/workers.service';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { id } = await params;

  if (!parseUuidParam(id)) {
    return NextResponse.json({ error: 'Invalid worker id' }, { status: 400 });
  }

  try {
    await deleteWorker({
      supabase: res.supabase,
      workerId: id,
      managerSystemId: res.profile.system_id,
    });
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}
