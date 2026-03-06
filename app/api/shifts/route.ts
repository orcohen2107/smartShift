import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { requireManager } from "@/lib/auth/requireManager";
import { getSupabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { Shift, ShiftPostBody } from "@/lib/utils/interfaces";
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

  if (type === "day" || type === "night" || type === "full_day") {
    query = query.eq("type", type);
  }

  const boardId = url.searchParams.get("board_id");
  if (boardId) {
    query = query.eq("board_id", boardId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shifts: (data ?? []) as Shift[] });
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const body = (await req.json()) as ShiftPostBody;

  if (!body.date || !body.type) {
    return NextResponse.json(
      { error: "Missing date or type" },
      { status: 400 },
    );
  }

  const insertPayload: Record<string, unknown> = {
    date: body.date,
    type: body.type,
    created_by: profile.id,
    required_count: body.required_count ?? 1,
  };
  if (body.board_id) {
    insertPayload.board_id = body.board_id;
  }

  // שימוש ב-admin כדי שהמשמרת תישמר ותופיע לכל המנהלים במערכת
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("shifts")
    .insert(insertPayload)
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

