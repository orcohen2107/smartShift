import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin';

export class ForbiddenError extends Error {
  public status = 403;
  constructor(message = 'Access denied') {
    super(message);
  }
}

/**
 * Verifies that a board belongs to the given system.
 * Throws ForbiddenError if it does not.
 */
export async function assertBoardOwnership(
  boardId: string,
  systemId: string | null
): Promise<void> {
  if (!systemId) {
    throw new ForbiddenError('No system assigned');
  }

  const admin = getSupabaseAdmin();
  const { data: board } = await admin
    .from('shift_boards')
    .select('system_id')
    .eq('id', boardId)
    .single();

  if (!board) {
    throw new ForbiddenError('Board not found');
  }

  if (board.system_id !== systemId) {
    throw new ForbiddenError('You do not have permission to access this board');
  }
}

/**
 * Verifies that a shift (via its board) belongs to the given system.
 * Returns the shift row. Throws ForbiddenError on mismatch.
 */
export async function assertShiftOwnership(
  shiftId: string,
  systemId: string | null
): Promise<{ id: string; board_id: string | null }> {
  const admin = getSupabaseAdmin();
  const { data: shift } = await admin
    .from('shifts')
    .select('id, board_id')
    .eq('id', shiftId)
    .single();

  if (!shift) {
    throw new ForbiddenError('Shift not found');
  }

  if (shift.board_id) {
    await assertBoardOwnership(shift.board_id, systemId);
  }

  return shift;
}

/**
 * Verifies that an assignment (via shift -> board) belongs to the given system.
 * Throws ForbiddenError on mismatch.
 */
export async function assertAssignmentOwnership(
  assignmentId: string,
  systemId: string | null
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: assignment } = await admin
    .from('assignments')
    .select('id, shift_id')
    .eq('id', assignmentId)
    .single();

  if (!assignment) {
    throw new ForbiddenError('Assignment not found');
  }

  await assertShiftOwnership(assignment.shift_id, systemId);
}

/**
 * Verifies that a profile belongs to the same system as the requester.
 * Throws ForbiddenError on mismatch.
 */
export async function assertProfileInSystem(
  profileId: string,
  systemId: string | null
): Promise<void> {
  if (!systemId) {
    throw new ForbiddenError('No system assigned');
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from('profiles')
    .select('system_id')
    .eq('id', profileId)
    .single();

  if (!profile) {
    throw new ForbiddenError('Profile not found');
  }

  if (profile.system_id !== systemId) {
    throw new ForbiddenError(
      'You do not have permission to modify this profile'
    );
  }
}
