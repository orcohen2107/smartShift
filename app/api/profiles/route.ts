import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/requireManager";
import { getSupabaseAdmin } from "@/lib/db/supabaseAdmin";
import type { Profile } from "@/lib/utils/interfaces";

export async function GET(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const admin = getSupabaseAdmin();
  const systemId = res.profile.system_id;
  let query = admin
    .from("profiles")
    .select("id, full_name, email, role, system_id, created_at")
    .order("full_name", { ascending: true });
  if (systemId) {
    query = query.eq("system_id", systemId);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: (data ?? []) as Profile[] });
}
