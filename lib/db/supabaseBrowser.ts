import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowser() must be called in the browser');
  }

  if (!browserClient) {
    const { url, anonKey } = getSupabaseEnv();
    browserClient = createClient(url, anonKey);
  }

  return browserClient;
}
