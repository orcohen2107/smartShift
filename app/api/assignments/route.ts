import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { requireManager } from "@/lib/auth/requireManager";
import { getSupabaseAdmin } from "@/lib/db/supabaseAdmin";
import type {
  Assignment,
  AssignmentsOverview,
  AssignmentPostBody,
  Constraint,
  Shift,
  ShiftBoard,
  Worker,
} from "@/lib/utils/interfaces";

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const systemId = profile.system_id;
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") as string | null;
  const type = typeParam === "day" || typeParam === "night" || typeParam === "full_day" ? typeParam : null;
  const allTypes = typeParam === "all" || !typeParam;
  const boardId = url.searchParams.get("board_id");

  // לוחות משותפים לכל המערכות
  const { data: allBoards, error: boardsErr } = await supabase
    .from("shift_boards")
    .select("id")
    .order("created_at", { ascending: true });
  if (boardsErr) {
    return NextResponse.json({ error: boardsErr.message }, { status: 500 });
  }
  const validBoardIds = (allBoards ?? []).map((b) => b.id);

  let shiftsQuery = supabase
    .from("shifts")
    .select("*")
    .order("date", { ascending: true });
  if (validBoardIds.length > 0) {
    shiftsQuery = shiftsQuery.in("board_id", validBoardIds);
  } else {
    shiftsQuery = shiftsQuery.eq("board_id", "00000000-0000-0000-0000-000000000000");
  }
  if (!allTypes && type) {
    shiftsQuery = shiftsQuery.eq("type", type);
  }
  if (boardId && validBoardIds.includes(boardId)) {
    shiftsQuery = shiftsQuery.eq("board_id", boardId);
  }

  const { data: shifts, error: shiftsError } = await shiftsQuery;

  if (shiftsError) {
    return NextResponse.json(
      { error: shiftsError.message },
      { status: 500 },
    );
  }

  const shiftIds = (shifts ?? []).map((s) => s.id);

  const { data: rawAssignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("*")
    .in("shift_id", shiftIds.length ? shiftIds : ["00000000-0000-0000-0000-000000000000"]);

  if (assignmentsError) {
    return NextResponse.json(
      { error: assignmentsError.message },
      { status: 500 },
    );
  }

  // רשימת הכוננים של המערכת
  let workersQuery = supabase
    .from("workers")
    .select("*")
    .order("full_name", { ascending: true });
  if (systemId) {
    workersQuery = workersQuery.eq("system_id", systemId);
  }
  const { data: allWorkers, error: allWorkersError } = await workersQuery;

  if (allWorkersError) {
    return NextResponse.json(
      { error: allWorkersError.message },
      { status: 500 },
    );
  }

  const dates = Array.from(new Set((shifts ?? []).map((s) => s.date)));
  const typesFilter = allTypes ? ["day", "night", "full_day"] : type ? [type] : ["day", "night", "full_day"];

  // אילוצים של עובדי המערכת בלבד
  const systemWorkerIds = new Set((allWorkers ?? []).map((w) => w.id));
  const assignments = (rawAssignments ?? []).filter((a) => systemWorkerIds.has(a.worker_id));

  const workerIds = (allWorkers ?? []).map((w) => w.id);
  let constraintsQuery = supabase
    .from("constraints")
    .select("*")
    .in("date", dates.length ? dates : ["1900-01-01"])
    .in("type", typesFilter);
  if (workerIds.length > 0) {
    constraintsQuery = constraintsQuery.in("worker_id", workerIds);
  } else {
    constraintsQuery = constraintsQuery.eq("worker_id", "00000000-0000-0000-0000-000000000000");
  }
  const { data: constraints, error: constraintsError } = await constraintsQuery;

  if (constraintsError) {
    return NextResponse.json(
      { error: constraintsError.message },
      { status: 500 },
    );
  }

  const { data: boards, error: boardsError } = await supabase
    .from("shift_boards")
    .select("*")
    .order("created_at", { ascending: true });

  if (boardsError) {
    return NextResponse.json(
      { error: boardsError.message },
      { status: 500 },
    );
  }

  const payload: AssignmentsOverview = {
    shifts: (shifts ?? []) as Shift[],
    assignments: assignments as Assignment[],
    workers: (allWorkers ?? []) as Worker[],
    constraints: (constraints ?? []) as Constraint[],
    boards: (boards ?? []) as ShiftBoard[],
  };

  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const body = (await req.json()) as AssignmentPostBody;

  if (!body.shift_id || !body.worker_id) {
    return NextResponse.json(
      { error: "Missing shift_id or worker_id" },
      { status: 400 },
    );
  }

  // וידוא שהעובד במערכת של המנהל
  if (profile.system_id) {
    const { data: worker } = await supabase
      .from("workers")
      .select("id")
      .eq("id", body.worker_id)
      .eq("system_id", profile.system_id)
      .single();
    if (!worker) {
      return NextResponse.json(
        { error: "Worker not in your system" },
        { status: 403 },
      );
    }
  }

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      shift_id: body.shift_id,
      worker_id: body.worker_id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create assignment" },
      { status: 500 },
    );
  }

  return NextResponse.json(data as Assignment, { status: 201 });
}

export async function DELETE(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const url = new URL(req.url);
  const assignmentId = url.searchParams.get("assignment_id");

  if (!assignmentId) {
    return NextResponse.json(
      { error: "Missing assignment_id" },
      { status: 400 },
    );
  }

  // שימוש ב-admin client כדי לעקוף RLS – כבר אומת שהמשתמש מנהל
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    console.error("[DELETE /api/assignments]", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to delete assignment" },
      { status: 500 },
    );
  }

  return new Response(null, { status: 204 });
}

