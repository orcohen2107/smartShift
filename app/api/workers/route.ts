import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import {
  listWorkers,
  createWorker,
} from '@/features/workers/server/workers.service';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { workerPostSchema } from '@/lib/utils/schemas/workers';

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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const parsed = await parseBody(req, workerPostSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const worker = await createWorker({
      supabase: res.supabase,
      fullName: parsed.data.full_name,
      systemId: res.profile.system_id ?? null,
    });
    return NextResponse.json(worker, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
