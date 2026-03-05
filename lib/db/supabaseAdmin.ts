import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const { url, anonKey } = getSupabaseEnv();
    adminClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return adminClient;
}

