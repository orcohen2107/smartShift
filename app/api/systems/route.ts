import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';
import { parseBody } from '@/lib/utils/schemas/parseBody';
import { systemPostSchema } from '@/lib/utils/schemas/systems';
import type { System } from '@/lib/utils/interfaces';

/** רשימת מערכות – ציבורי (להרשמה) */
export async function GET() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('systems')
    .select('id, name, created_at')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch systems' },
      { status: 500 }
    );
  }

  return NextResponse.json({ systems: (data ?? []) as System[] });
}

/** הוספת מערכת – מנהל בלבד */
export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const parsed = await parseBody(req, systemPostSchema);
  if (!parsed.ok) return parsed.response;
  const name = parsed.data.name;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('systems')
    .insert({ name })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Failed to create system' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as System, { status: 201 });
}
