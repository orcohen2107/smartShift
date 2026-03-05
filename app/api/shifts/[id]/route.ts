import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/requireManager";
import type { Shift, ShiftPatchBody } from "@/lib/utils/interfaces";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const { id } = await params;
  const body = (await req.json()) as ShiftPatchBody;

  const update: Record<string, unknown> = {};
  if (body.date !== undefined) update.date = body.date;
  if (body.type !== undefined) update.type = body.type;

  const { data, error } = await supabase
    .from("shifts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update shift" },
      { status: 500 },
    );
  }

  return NextResponse.json(data as Shift);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const { id } = await params;

  const { error } = await supabase.from("shifts").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to delete shift" },
      { status: 500 },
    );
  }

  return NextResponse.json({}, { status: 204 });
}

