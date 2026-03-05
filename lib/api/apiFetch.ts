import { getSupabaseBrowser } from '../db/supabaseBrowser';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function apiFetch<T>(input: string,init?: RequestInit & { json?: unknown }): Promise<T> {
  const supabase: SupabaseClient = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const headers: Headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init?.json) headers.set('Content-Type', 'application/json');

  const body = init?.json ? JSON.stringify(init.json) : init?.body;

  const res = await fetch(input, { ...init,headers, body });

  const text: string = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = parsed && typeof parsed === 'object' && 'error' in parsed ? String(parsed.error) : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return parsed as unknown as T;
}

