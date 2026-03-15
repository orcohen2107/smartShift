import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import {
  listWorkers,
  createWorker,
} from '@/features/workers/server/workers.service';
import type { WorkerPostBody } from '@/lib/utils/interfaces';

export async function GET(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  try {
    const workers = await listWorkers(res.profile.system_id);
    return NextResponse.json({ workers });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const body = (await req.json()) as WorkerPostBody;
  const fullName = body.full_name?.trim();
  if (!fullName) {
    return NextResponse.json(
      { error: 'full_name is required' },
      { status: 400 }
    );
  }

  try {
    const worker = await createWorker({
      supabase: res.supabase,
      fullName,
      systemId: res.profile.system_id ?? null,
    });
    return NextResponse.json(worker, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
