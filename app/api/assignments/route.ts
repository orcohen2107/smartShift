import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireManager } from '@/lib/auth/requireManager';
import {
  getAssignmentsOverview,
  createAssignment,
  deleteAssignment,
  ServiceError,
} from '@/features/assignments/server/assignments.service';
import type { AssignmentPostBody } from '@/lib/utils/interfaces';

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
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const body = (await req.json()) as AssignmentPostBody;

  if (!body.shift_id || !body.worker_id) {
    return NextResponse.json(
      { error: 'Missing shift_id or worker_id' },
      { status: 400 }
    );
  }

  try {
    const assignment = await createAssignment({
      shiftId: body.shift_id,
      workerId: body.worker_id,
      systemId: res.profile.system_id,
      supabase: res.supabase,
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err: unknown) {
    const status = err instanceof ServiceError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status }
    );
  }
}

export async function DELETE(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const url = new URL(req.url);
  const assignmentId = url.searchParams.get('assignment_id');

  if (!assignmentId) {
    return NextResponse.json(
      { error: 'Missing assignment_id' },
      { status: 400 }
    );
  }

  try {
    await deleteAssignment(assignmentId);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
