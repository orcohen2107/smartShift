import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import type { Constraint } from "@/lib/utils/interfaces";
import type { ConstraintStatus, ShiftType } from "@/lib/utils/enums";

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const url = new URL(req.url);
  const allParam = url.searchParams.get("all");
  const managerWantsAll = profile.role === "manager" && allParam === "1";

  const query = supabase
    .from("constraints")
    .select("*")
    .order("date", { ascending: true })
    .order("type", { ascending: true });

  if (!managerWantsAll && profile.role !== "manager") {
    query.eq("worker_id", profile.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ constraints: (data ?? []) as Constraint[] });
}

type PostBody = {
  date: string;
  type: ShiftType;
  status?: ConstraintStatus;
  note?: string;
};

export async function POST(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const body = (await req.json()) as PostBody;

  if (!body.date || !body.type) {
    return NextResponse.json(
      { error: "Missing date or type" },
      { status: 400 },
    );
  }

  const status: ConstraintStatus = "unavailable";

  const { data, error } = await supabase
    .from("constraints")
    .insert({
      worker_id: profile.id,
      date: body.date,
      type: body.type,
      status,
      note: body.note ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create constraint" },
      { status: 500 },
    );
  }

  return NextResponse.json(data as Constraint, { status: 201 });
}

