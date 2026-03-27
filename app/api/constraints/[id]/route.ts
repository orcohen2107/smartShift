import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { Role } from '@/lib/utils/enums';
import { parseBody, parseUuidParam } from '@/lib/utils/schemas/parseBody';
import { constraintPatchSchema } from '@/lib/utils/schemas/constraints';
import {
  updateConstraint,
  deleteConstraint,
} from '@/features/constraints/server/constraints.service';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';

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

  if (!parseUuidParam(id)) {
    return NextResponse.json(
      { error: 'Invalid constraint id' },
      { status: 400 }
    );
  }

  const parsed = await parseBody(req, constraintPatchSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const updated = await updateConstraint({
      supabase: res.supabase,
      profileId: res.profile.id,
      constraintId: id,
      body: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
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

  if (!parseUuidParam(id)) {
    return NextResponse.json(
      { error: 'Invalid constraint id' },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}
