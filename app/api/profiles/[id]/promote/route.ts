import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { promoteProfile } from '@/features/profile/server/profile.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing profile id' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role: 'manager' | 'commander' =
    body.role === 'commander' ? 'commander' : 'manager';

  try {
    const profile = await promoteProfile({ profileId: id, role });
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
