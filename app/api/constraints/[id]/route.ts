import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { Role } from '@/lib/utils/enums';
import type { ConstraintPatchBody } from '@/lib/utils/interfaces';
import {
  updateConstraint,
  deleteConstraint,
  ServiceError,
} from '@/features/constraints/server/constraints.service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  if (res.profile.role === Role.Guest) {
    return NextResponse.json(
      { error: 'Guests cannot edit constraints' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await req.json()) as ConstraintPatchBody;

  try {
    const updated = await updateConstraint({
      supabase: res.supabase,
      profileId: res.profile.id,
      constraintId: id,
      body,
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const status = err instanceof ServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  if (res.profile.role === Role.Guest) {
    return NextResponse.json(
      { error: 'Guests cannot delete constraints' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const url = new URL(req.url);

  try {
    await deleteConstraint({
      supabase: res.supabase,
      profileId: res.profile.id,
      constraintId: id,
      deleteSeries: url.searchParams.get('series') === '1',
    });
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const status = err instanceof ServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    );
  }
}
