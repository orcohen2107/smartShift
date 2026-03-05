import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getSupabaseServiceRoleKey } from './env';

let adminClient: SupabaseClient | null = null;

/** לקוח עם הרשאות מלאות – עוקף RLS. לשימוש רק אחרי אימות (requireManager וכו׳) */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const { url, anonKey } = getSupabaseEnv();
    const serviceKey = getSupabaseServiceRoleKey();
    const key = serviceKey ?? anonKey;
    adminClient = createClient(url, key, {
      auth: {
        persistSession: false,
      },
    });
  }

  return adminClient;
}

