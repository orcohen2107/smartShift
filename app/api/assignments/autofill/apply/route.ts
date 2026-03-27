import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { applyAutofill } from '@/features/assignments/server/autofill.service';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { autofillApplySchema } from '@/lib/utils/schemas/assignments';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(req: Request) {
  const limited = await rateLimit(req, { windowMs: 60_000, maxRequests: 10 });
  if (limited) return limited;

  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const parsed = await parseBody(req, autofillApplySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const additions = body.additions ?? body.assignments ?? [];
  const removals = body.removals ?? [];

  if (additions.length === 0 && removals.length === 0) {
    return NextResponse.json(
      { error: 'At least one addition or removal is required' },
      { status: 400 }
    );
  }

  try {
    const result = await applyAutofill({
      body,
      profileId: res.profile.id,
      systemId: res.profile.system_id,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}
