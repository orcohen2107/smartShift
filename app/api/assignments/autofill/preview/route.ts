import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { previewAutofill } from '@/features/assignments/server/autofill.service';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { autofillBodySchema } from '@/lib/utils/schemas/assignments';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(req: Request) {
  const limited = await rateLimit(req, { windowMs: 60_000, maxRequests: 10 });
  if (limited) return limited;

  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const parsed = await parseBody(req, autofillBodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await previewAutofill({
      body: parsed.data,
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
