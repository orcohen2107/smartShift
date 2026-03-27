import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireManager } from '@/lib/auth/requireManager';
import {
  getAssignmentsOverview,
  createAssignment,
  deleteAssignment,
} from '@/features/assignments/server/assignments.service';
import { safeErrorMessage, safeErrorStatus } from '@/lib/utils/errors';
import { parseBody, parseUuidParam } from '@/lib/utils/schemas/parseBody';
import { assignmentPostSchema } from '@/lib/utils/schemas/assignments';

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const url = new URL(req.url);

  try {
    const overview = await getAssignmentsOverview({
      systemId: res.profile.system_id,
      supabase: res.supabase,
      typeParam: url.searchParams.get('type'),
      boardId: url.searchParams.get('board_id'),
    });
    return NextResponse.json(overview);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const parsed = await parseBody(req, assignmentPostSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const assignment = await createAssignment({
      shiftId: parsed.data.shift_id,
      workerId: parsed.data.worker_id,
      systemId: res.profile.system_id,
      supabase: res.supabase,
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}

export async function DELETE(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const url = new URL(req.url);
  const assignmentId = parseUuidParam(url.searchParams.get('assignment_id'));

  if (!assignmentId) {
    return NextResponse.json(
      { error: 'Missing or invalid assignment_id' },
      { status: 400 }
    );
  }

  try {
    await deleteAssignment(assignmentId, res.profile.system_id);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err) },
      { status: safeErrorStatus(err) }
    );
  }
}
