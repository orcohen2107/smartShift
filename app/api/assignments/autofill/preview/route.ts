import { NextResponse } from 'next/server';
import { requireManager } from '@/lib/auth/requireManager';
import { previewAutofill } from '@/features/assignments/server/autofill.service';
import type { AutofillPreviewBody } from '@/features/assignments/types';

export async function POST(req: Request) {
  const res = await requireManager(req);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const body = (await req.json()) as AutofillPreviewBody;

  if (!body.board_id || !body.from_date || !body.to_date) {
    return NextResponse.json(
      { error: 'Missing board_id, from_date or to_date' },
      { status: 400 }
    );
  }

  try {
    const result = await previewAutofill({
      body,
      systemId: res.profile.system_id,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
