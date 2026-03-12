import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';
import type { ServerSupabaseContext } from '../utils/types/ServerSupabaseContext';

export function getSupabaseServer(ctx: ServerSupabaseContext): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
      },
    },
  });
}
