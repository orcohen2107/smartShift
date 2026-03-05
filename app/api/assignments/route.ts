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

  const { supabase } = res;
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") as string | null;
  const type = typeParam === "day" || typeParam === "night" || typeParam === "full_day" ? typeParam : null;
  const allTypes = typeParam === "all" || !typeParam;
  const boardId = url.searchParams.get("board_id");

  let query = supabase
    .from("shifts")
    .select("*")
    .order("date", { ascending: true });

  if (!allTypes && type) {
    query = query.eq("type", type);
  }
  if (boardId) {
    query = query.eq("board_id", boardId);
  }

  const { data: shifts, error: shiftsError } = await query;

  if (shiftsError) {
    return NextResponse.json(
      { error: shiftsError.message },
      { status: 500 },
    );
  }

  const shiftIds = (shifts ?? []).map((s) => s.id);

  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("*")
    .in("shift_id", shiftIds.length ? shiftIds : ["00000000-0000-0000-0000-000000000000"]);

  if (assignmentsError) {
    return NextResponse.json(
      { error: assignmentsError.message },
      { status: 500 },
    );
  }

  // רשימת כל הכוננים לשיבוץ (מטבלת workers – כולל כאלה שעדיין לא נרשמו)
  const { data: allWorkers, error: allWorkersError } = await supabase
    .from("workers")
    .select("*")
    .order("full_name", { ascending: true });

  if (allWorkersError) {
    return NextResponse.json(
      { error: allWorkersError.message },
      { status: 500 },
    );
  }

  const dates = Array.from(new Set((shifts ?? []).map((s) => s.date)));
  const typesFilter = allTypes ? ["day", "night", "full_day"] : type ? [type] : ["day", "night", "full_day"];

  const { data: constraints, error: constraintsError } = await supabase
    .from("constraints")
    .select("*")
    .in("date", dates.length ? dates : ["1900-01-01"])
    .in("type", typesFilter);

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
    assignments: (assignments ?? []) as Assignment[],
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

  const { supabase } = res;
  const body = (await req.json()) as AssignmentPostBody;

  if (!body.shift_id || !body.worker_id) {
    return NextResponse.json(
      { error: "Missing shift_id or worker_id" },
      { status: 400 },
    );
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

