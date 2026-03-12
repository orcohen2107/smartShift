import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import type { Profile } from '@/lib/utils/interfaces';

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ profile: res.profile as Profile });
}
