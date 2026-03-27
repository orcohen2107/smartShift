import type { ZodType } from 'zod';
import { NextResponse } from 'next/server';

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    );
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: messages },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}

export function parseUuidParam(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
}
