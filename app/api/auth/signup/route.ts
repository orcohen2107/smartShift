import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import type { SignupBody } from '@/lib/utils/interfaces';

export async function POST(req: Request) {
  const { email, password, full_name, system_id, is_reserves } =
    (await req.json()) as SignupBody;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const metadata: Record<string, unknown> = {};
  if (full_name) metadata.full_name = full_name.trim();
  if (system_id) metadata.system_id = system_id;
  metadata.is_reserves = is_reserves === true;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: Object.keys(metadata).length ? metadata : undefined,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    userId: data.user?.id ?? null,
    requiresEmailConfirmation: !data.session,
  });
}
