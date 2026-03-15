import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/db/supabaseServer';
import { getAccessTokenFromRequest } from '@/lib/auth/authHeader';
import { ensureProfile } from '@/features/profile/server/profile.service';

export async function POST(req: Request) {
  const accessToken = getAccessTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Missing bearer token' },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServer({ accessToken });
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const user = userData.user;

  try {
    const profile = await ensureProfile({
      supabase,
      userId: user.id,
      email: user.email ?? '',
      fullName:
        (user.user_metadata?.full_name as string)?.trim() || user.email || '',
      systemId: (user.user_metadata?.system_id as string) || null,
      userType: (user.user_metadata?.user_type as string) || 'worker',
      isReserves:
        user.user_metadata?.user_type === 'worker_reserves' ||
        user.user_metadata?.is_reserves === true,
    });
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
