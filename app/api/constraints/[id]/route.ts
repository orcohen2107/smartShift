import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getSupabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { Constraint, ConstraintPatchBody } from "@/lib/utils/interfaces";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from("constraints")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // רק בעל האילוץ יכול לערוך
  if (existing.worker_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as ConstraintPatchBody;

  const update: Record<string, unknown> = {};
  if (body.date !== undefined) update.date = body.date;
  if (body.type !== undefined) update.type = body.type;
  if (body.status !== undefined) update.status = body.status;
  if (body.note !== undefined) update.note = body.note;

  const { data, error } = await supabase
    .from("constraints")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update constraint" },
      { status: 500 },
    );
  }

  return NextResponse.json(data as Constraint);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await requireUser(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from("constraints")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.worker_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // שימוש ב-admin client כדי לעקוף RLS – כבר אומת שהמשתמש רשאי למחוק
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("constraints").delete().eq("id", id);

  if (error) {
    console.error("[DELETE /api/constraints/[id]]", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to delete constraint" },
      { status: 500 },
    );
  }

  return new Response(null, { status: 204 });
}

