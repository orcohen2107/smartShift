import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { applyAutofill } from '@/features/assignments/server/autofill.service';
import type { AutofillApplyBody } from '@/features/assignments/types';

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const body = (await req.json()) as AutofillApplyBody;

  const additions = body.additions ?? body.assignments ?? [];
  const removals = body.removals ?? [];

  if (
    !body.board_id ||
    !body.from_date ||
    !body.to_date ||
    (additions.length === 0 && removals.length === 0)
  ) {
    return NextResponse.json(
      { error: 'Missing board_id, from_date, to_date or assignments' },
      { status: 400 }
    );
  }

  try {
    const result = await applyAutofill({
      body,
      profileId: res.profile.id,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
