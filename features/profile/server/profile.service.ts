import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { assertProfileInSystem } from '@/lib/auth/assertOwnership';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/utils/interfaces';

// ── Ensure profile ──

export async function ensureProfile(params: {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  fullName: string;
  systemId: string | null;
  userType: string;
  isReserves: boolean;
}): Promise<Profile> {
  const { supabase, userId, email, fullName, systemId, userType, isReserves } =
    params;
  const admin = getSupabaseAdmin();

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  if (existingProfile) {
    const profile = existingProfile as Profile & {
      system_id?: string | null;
      is_reserves?: boolean;
    };
    if (profile.role === 'worker') {
      await ensureWorkerRow(admin, supabase, profile);
    }
    return profile as Profile;
  }

  return createNewProfile({
    supabase,
    admin,
    userId,
    email,
    fullName,
    systemId,
    userType,
    isReserves,
  });
}

async function ensureWorkerRow(
  admin: SupabaseClient,
  supabase: SupabaseClient,
  profile: Profile & { system_id?: string | null; is_reserves?: boolean }
) {
  const { data: existingWorker } = await admin
    .from('workers')
    .select('id')
    .eq('id', profile.id)
    .maybeSingle();

  if (!existingWorker) {
    const { error: workerInsertErr } = await supabase.from('workers').insert({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      user_id: profile.id,
      system_id: profile.system_id ?? null,
      is_reserves: profile.is_reserves ?? false,
    });
    if (workerInsertErr) {
      throw new Error(`Worker creation failed: ${workerInsertErr.message}`);
    }
  }
}

async function createNewProfile(params: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  email: string;
  fullName: string;
  systemId: string | null;
  userType: string;
  isReserves: boolean;
}): Promise<Profile> {
  const {
    supabase,
    admin,
    userId,
    email,
    fullName,
    systemId,
    userType,
    isReserves,
  } = params;

  const { count, error: countError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(countError.message);

  const role =
    !count || count === 0
      ? 'manager'
      : userType === 'guest'
        ? 'guest'
        : 'worker';

  let finalSystemId = systemId;
  if (!finalSystemId) {
    const { data: firstSystem } = await supabase
      .from('systems')
      .select('id')
      .limit(1)
      .single();
    finalSystemId = firstSystem?.id ?? null;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      full_name: fullName,
      email: email || null,
      role,
      system_id: finalSystemId,
      is_reserves: isReserves,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? 'Failed to create profile');
  }

  const profileSystemId =
    (inserted as { system_id?: string | null })?.system_id ?? null;

  if (role === 'worker') {
    await linkOrCreateWorker({
      supabase,
      admin,
      userId,
      email,
      fullName,
      profileSystemId,
      isReserves,
    });
  }

  return inserted as Profile;
}

async function linkOrCreateWorker(params: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  email: string;
  fullName: string;
  profileSystemId: string | null;
  isReserves: boolean;
}) {
  const {
    supabase,
    admin,
    userId,
    email,
    fullName,
    profileSystemId,
    isReserves,
  } = params;

  let toLinkQuery = admin
    .from('workers')
    .select('id')
    .is('user_id', null)
    .ilike('full_name', fullName.trim())
    .limit(1);
  if (profileSystemId) {
    toLinkQuery = toLinkQuery.eq('system_id', profileSystemId);
  }
  const { data: unlinkedWorkers } = await toLinkQuery;
  const toLink = unlinkedWorkers?.[0];

  if (toLink?.id) {
    const { error: updateErr } = await supabase
      .from('workers')
      .update({
        user_id: userId,
        email: email || null,
        is_reserves: isReserves,
      })
      .eq('id', toLink.id);
    if (updateErr) {
      throw new Error(`Worker link failed: ${updateErr.message}`);
    }
  } else {
    const { error: workerInsertErr } = await supabase.from('workers').insert({
      id: userId,
      full_name: fullName,
      email: email ?? null,
      user_id: userId,
      system_id: profileSystemId,
      is_reserves: isReserves,
    });
    if (workerInsertErr) {
      throw new Error(`Worker creation failed: ${workerInsertErr.message}`);
    }
  }
}

// ── List profiles ──

export async function listProfiles(
  systemId: string | null
): Promise<Profile[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('profiles')
    .select('id, full_name, email, role, system_id, created_at')
    .order('full_name', { ascending: true });
  if (systemId) {
    query = query.eq('system_id', systemId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

// ── Promote profile ──

export async function promoteProfile(params: {
  profileId: string;
  role: 'manager' | 'commander';
  managerSystemId: string | null;
}): Promise<Profile> {
  const { profileId, role, managerSystemId } = params;

  await assertProfileInSystem(profileId, managerSystemId);

  const admin = getSupabaseAdmin();

  const { data: profile, error: updateError } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select('*')
    .single();

  if (updateError || !profile) {
    throw new Error(updateError?.message ?? 'Profile not found');
  }

  if (role === 'manager') {
    const profileSystemId =
      (profile as { system_id?: string | null }).system_id ?? null;
    await admin.from('workers').upsert(
      {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        user_id: profile.id,
        system_id: profileSystemId,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  }

  return profile as Profile;
}
