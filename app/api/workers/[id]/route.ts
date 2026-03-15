import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import {
  deleteWorker,
  ServiceError,
} from '@/features/workers/server/workers.service';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { id } = await params;

  try {
    await deleteWorker({
      supabase: res.supabase,
      workerId: id,
      managerSystemId: res.profile.system_id,
    });
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const status = err instanceof ServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    );
  }
}
