import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { promoteProfile } from '@/features/profile/server/profile.service';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';
import { parseBody, parseUuidParam } from '@/lib/utils/schemas/parseBody';
import { promoteSchema } from '@/lib/utils/schemas/profiles';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, { windowMs: 60_000, maxRequests: 10 });
  if (limited) return limited;

  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { id } = await params;
  if (!parseUuidParam(id)) {
    return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
  }

  const parsed = await parseBody(req, promoteSchema);
  if (!parsed.ok) return parsed.response;
  const role: 'manager' | 'commander' = parsed.data.role ?? 'manager';

  try {
    const profile = await promoteProfile({
      profileId: id,
      role,
      managerSystemId: res.profile.system_id,
    });
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}
