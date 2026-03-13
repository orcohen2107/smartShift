import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import type { Profile } from '@/lib/utils/interfaces';

type PromoteRole = 'manager' | 'commander';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing profile id' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role: PromoteRole = body.role === 'commander' ? 'commander' : 'manager';

  const admin = getSupabaseAdmin();

  const { data: profile, error: updateError } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !profile) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Profile not found' },
      { status: 500 }
    );
  }

  // מנהל מקבל שורת worker (לשיבוץ); מפקד לא
  if (role === 'manager') {
    const profileSystemId =
      (profile as { system_id?: string | null }).system_id ?? null;
    await admin.from('workers').upsert(
      {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        user_id: profile.id,
        system_id: profileSystemId,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ profile: profile as Profile });
}
