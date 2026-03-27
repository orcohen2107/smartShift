import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { signupSchema } from '@/lib/utils/schemas/auth';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(req: Request) {
  const limited = await rateLimit(req, { windowMs: 60_000, maxRequests: 5 });
  if (limited) return limited;

  const parsed = await parseBody(req, signupSchema);
  if (!parsed.ok) return parsed.response;

  const {
    email,
    password,
    full_name,
    system_id,
    user_type = 'worker',
  } = parsed.data;

  const ut = user_type ?? 'worker';

  const supabase = getSupabaseAdmin();
  const metadata: Record<string, unknown> = {};
  if (full_name) metadata.full_name = full_name.trim();
  if (system_id) metadata.system_id = system_id;
  metadata.user_type = ut;
  metadata.is_reserves = ut === 'worker_reserves';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: Object.keys(metadata).length ? metadata : undefined,
    },
  });

  if (error) {
    const safeMsg = error.message?.includes('already registered')
      ? 'A user with this email already exists'
      : 'Signup failed';
    return NextResponse.json({ error: safeMsg }, { status: 400 });
  }

  return NextResponse.json({
    userId: data.user?.id ?? null,
    requiresEmailConfirmation: !data.session,
  });
}
