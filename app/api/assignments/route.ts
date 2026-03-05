import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { requireManager } from "@/lib/auth/requireManager";
import type {
  Assignment,
  AssignmentsOverview,
  AssignmentDeleteBody,
  AssignmentPostBody,
  Constraint,
  Profile,
  Shift,
} from "@/lib/utils/interfaces";
import type { ShiftType } from "@/lib/utils/enums";

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ShiftType | null;

  if (type !== "day" && type !== "night") {
    return NextResponse.json(
      { error: "Query param 'type' must be 'day' or 'night'" },
      { status: 400 },
    );
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("*")
    .eq("type", type)
    .order("date", { ascending: true });

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

  const workerIds = Array.from(
    new Set((assignments ?? []).map((a) => a.worker_id)),
  );

  const { data: workers, error: workersError } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "worker")
    .in(
      "id",
      workerIds.length ? workerIds : ["00000000-0000-0000-0000-000000000000"],
    );

  if (workersError) {
    return NextResponse.json(
      { error: workersError.message },
      { status: 500 },
    );
  }

  // Also fetch all workers (even if not yet assigned) so managers can assign them.
  const { data: allWorkers, error: allWorkersError } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "worker");

  if (allWorkersError) {
    return NextResponse.json(
      { error: allWorkersError.message },
      { status: 500 },
    );
  }

  const dates = Array.from(new Set((shifts ?? []).map((s) => s.date)));

  const { data: constraints, error: constraintsError } = await supabase
    .from("constraints")
    .select("*")
    .in(
      "date",
      dates.length ? dates : ["1900-01-01"],
    )
    .in("type", [type]);

  if (constraintsError) {
    return NextResponse.json(
      { error: constraintsError.message },
      { status: 500 },
    );
  }

  const payload: AssignmentsOverview = {
    shifts: (shifts ?? []) as Shift[],
    assignments: (assignments ?? []) as Assignment[],
    workers: (allWorkers ?? []) as Profile[],
    constraints: (constraints ?? []) as Constraint[],
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

  const { supabase } = res;
  const body = (await req.json()) as AssignmentDeleteBody;

  if (!body.assignment_id) {
    return NextResponse.json(
      { error: "Missing assignment_id" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", body.assignment_id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to delete assignment" },
      { status: 500 },
    );
  }

  return NextResponse.json({}, { status: 204 });
}

