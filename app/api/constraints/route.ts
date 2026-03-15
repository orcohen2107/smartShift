import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { Role } from '@/lib/utils/enums';
import type { ConstraintPostBody } from '@/lib/utils/interfaces';
import {
  getConstraints,
  createConstraint,
  ServiceError,
} from '@/features/constraints/server/constraints.service';

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
    const status = err instanceof ServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
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

  const body = (await req.json()) as ConstraintPostBody;

  try {
    const result = await createConstraint({
      supabase: res.supabase,
      profile: res.profile,
      body,
    });

    if (result.single) {
      return NextResponse.json(result.single, { status: 201 });
    }
    return NextResponse.json({ created: result.created }, { status: 201 });
  } catch (err: unknown) {
    const status = err instanceof ServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    );
  }
}
