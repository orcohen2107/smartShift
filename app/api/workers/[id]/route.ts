import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/requireManager";
import { getSupabaseAdmin } from "@/lib/db/supabaseAdmin";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { supabase, profile } = res;
  const { id } = await params;

  const { data: worker, error: fetchError } = await supabase
    .from("workers")
    .select("id, user_id, system_id")
    .eq("id", id)
    .single();

  if (fetchError || !worker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (profile.system_id && worker.system_id !== profile.system_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (worker.user_id != null) {
    return NextResponse.json(
      { error: "ניתן למחוק רק כונן שטרם נרשם למערכת" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("workers").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to delete worker" },
      { status: 500 },
    );
  }

  return new Response(null, { status: 204 });
}
