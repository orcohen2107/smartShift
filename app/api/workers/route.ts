import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/requireManager";
import type { Worker, WorkerPostBody } from "@/lib/utils/interfaces";

export async function GET(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workers: (data ?? []) as Worker[] });
}

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase } = res;
  const body = (await req.json()) as WorkerPostBody;
  const fullName = body.full_name?.trim();
  if (!fullName) {
    return NextResponse.json(
      { error: "full_name is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("workers")
    .insert({ full_name: fullName, email: null, user_id: null })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to add worker" },
      { status: 500 },
    );
  }

  return NextResponse.json(data as Worker, { status: 201 });
}
