import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/requireManager";
import type { Shift } from "@/lib/utils/interfaces";
import type { ShiftType } from "@/lib/utils/enums";

type Params = {
  params: {
    id: string;
  };
};

type PatchBody = {
  date?: string;
  type?: ShiftType;
  required_count?: number;
};

export async function PATCH(req: Request, { params }: Params) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const id = params.id;
  const body = (await req.json()) as PatchBody;

  const update: Record<string, unknown> = {};
  if (body.date !== undefined) update.date = body.date;
  if (body.type !== undefined) update.type = body.type;
  if (body.required_count !== undefined) {
    update.required_count = body.required_count;
  }

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

export async function DELETE(req: Request, { params }: Params) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const id = params.id;

  const { error } = await supabase.from("shifts").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to delete shift" },
      { status: 500 },
    );
  }

  return NextResponse.json({}, { status: 204 });
}

