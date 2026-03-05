import { getSupabaseServer } from '../db/supabaseServer';
import { getAccessTokenFromRequest } from '../auth/authHeader';
import type { Profile } from '../utils/interfaces';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function requireUser(req: Request) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return { ok: false as const, status: 401, error: 'Missing bearer token' };
  }

  const supabase: SupabaseClient = getSupabaseServer({ accessToken });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false as const, status: 401, error: 'Invalid session' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403,
      error: 'Missing profile',
    };
  }

  return {
    ok: true as const,
    supabase,
    user: userData.user,
    profile: profile as Profile,
  };
}

