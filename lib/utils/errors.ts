import { ForbiddenError } from '@/lib/auth/assertOwnership';

/**
 * Known application error types that expose their message safely.
 * Errors that are NOT in this list will be replaced with a generic message.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message);
  }
}

const SAFE_ERROR_TYPES = [ServiceError, ForbiddenError];

export function safeErrorMessage(err: unknown): string {
  if (SAFE_ERROR_TYPES.some((T) => err instanceof T)) {
    return (err as Error).message;
  }
  return 'Internal server error';
}

export function safeErrorStatus(err: unknown): number {
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof ServiceError) return err.status;
  return 500;
}
