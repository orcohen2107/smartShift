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
  const systemId =
    (userData.user.user_metadata?.system_id as string) || null;

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
    const profile = existingProfile as Profile & { system_id?: string | null };
    const { data: existingWorker } = await supabase
      .from("workers")
      .select("id")
      .eq("id", profile.id)
      .maybeSingle();
    if (!existingWorker) {
      await supabase.from("workers").insert({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        user_id: profile.id,
        system_id: profile.system_id ?? null,
      });
    }
    return NextResponse.json({ profile });
  }

  // Determine role for the first profile = manager, others = worker.
  const { count, error: countError } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const role = !count || count === 0 ? "manager" : "worker";

  // מערכת: מ-metadata או ברירת מחדל (ראשית)
  let finalSystemId = systemId;
  if (!finalSystemId) {
    const { data: firstSystem } = await supabase
      .from("systems")
      .select("id")
      .limit(1)
      .single();
    finalSystemId = firstSystem?.id ?? null;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      full_name: fullName,
      email: email || null,
      role,
      system_id: finalSystemId,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create profile" },
      { status: 500 },
    );
  }

  const profileSystemId = (inserted as { system_id?: string | null })?.system_id ?? null;

  // קישור worker קיים (שנוסף ידנית) לפי שם דומה ומערכת – מעדכן אימייל ו-user_id
  let toLinkQuery = supabase
    .from("workers")
    .select("id")
    .is("user_id", null)
    .ilike("full_name", fullName.trim())
    .limit(1);
  if (profileSystemId) {
    toLinkQuery = toLinkQuery.eq("system_id", profileSystemId);
  }
  const { data: unlinkedWorkers } = await toLinkQuery;

  const toLink = unlinkedWorkers?.[0];
  if (toLink?.id) {
    await supabase
      .from("workers")
      .update({ user_id: userId, email: email || null })
      .eq("id", toLink.id);
  } else {
    // פרופיל חדש (מנהל או כונן) – מוסיפים גם ל-workers כדי שיופיעו ברשימת השיבוץ
    await supabase.from("workers").insert({
      id: userId,
      full_name: fullName,
      email: email || null,
      user_id: userId,
      system_id: profileSystemId,
    });
  }

  return NextResponse.json({ profile: inserted as Profile });
}

