import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { requireManager } from "@/lib/auth/requireManager";
import type { Shift } from "@/lib/utils/interfaces";
import type { ShiftType } from "@/lib/utils/enums";

export async function GET(req: Request) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ShiftType | null;

  let query = supabase
    .from("shifts")
    .select("*")
    .order("date", { ascending: true });

  if (type === "day" || type === "night") {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shifts: (data ?? []) as Shift[] });
}

type PostBody = {
  date: string;
  type: ShiftType;
  required_count: number;
};

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const body = (await req.json()) as PostBody;

  if (!body.date || !body.type || !body.required_count) {
    return NextResponse.json(
      { error: "Missing date, type or required_count" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("shifts")
    .insert({
      date: body.date,
      type: body.type,
      required_count: body.required_count,
      created_by: profile.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create shift" },
      { status: 500 },
    );
  }

  return NextResponse.json(data as Shift, { status: 201 });
}

