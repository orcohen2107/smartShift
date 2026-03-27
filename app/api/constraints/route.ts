import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { Role } from '@/lib/utils/enums';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { constraintPostSchema } from '@/lib/utils/schemas/constraints';
import {
  getConstraints,
  createConstraint,
} from '@/features/constraints/server/constraints.service';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const url = new URL(req.url);

  try {
    const payload = await getConstraints({
      supabase: res.supabase,
      profile: res.profile,
      allParam: url.searchParams.get('all'),
    });
    return NextResponse.json(payload);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}

export async function POST(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  if (res.profile.role === Role.Guest) {
    return NextResponse.json(
      { error: 'Guests cannot create constraints' },
      { status: 403 }
    );
  }

  const parsed = await parseBody(req, constraintPostSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await createConstraint({
      supabase: res.supabase,
      profile: res.profile,
      body: parsed.data,
    });

    if (result.single) {
      return NextResponse.json(result.single, { status: 201 });
    }
    return NextResponse.json({ created: result.created }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}
