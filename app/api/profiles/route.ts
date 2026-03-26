import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { listProfiles } from '@/features/profile/server/profile.service';

export async function GET(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  try {
    const profiles = await listProfiles(res.profile.system_id);
    return NextResponse.json({ profiles });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
