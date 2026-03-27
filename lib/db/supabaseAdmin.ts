import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getSupabaseServiceRoleKey } from './env';

let adminClient: SupabaseClient | null = null;

/** לקוח עם הרשאות מלאות – עוקף RLS. לשימוש רק אחרי אימות (requireManager וכו׳) */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const { url } = getSupabaseEnv();
    const serviceKey = getSupabaseServiceRoleKey();
    if (!serviceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for admin operations'
      );
    }
    adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return adminClient;
}
