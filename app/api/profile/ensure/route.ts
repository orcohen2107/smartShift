import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabaseServer';
import { getAccessTokenFromRequest } from '@/lib/auth/authHeader';
import type { Profile } from '@/lib/utils/interfaces';

export async function POST(req: Request) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const supabase = getSupabaseServer({ accessToken });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const userId = userData.user.id;
  const email = userData.user.email ?? "";
  const fullName =
    (userData.user.user_metadata?.full_name as string)?.trim() || email;

  // Check if profile already exists.
  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (existingProfile) {
    return NextResponse.json({ profile: existingProfile as Profile });
  }

  // Determine role for the first profile = manager, others = worker.
  const { count, error: countError } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const role = !count || count === 0 ? "manager" : "worker";

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      full_name: fullName,
      email: email || null,
      role,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: inserted as Profile });
}

