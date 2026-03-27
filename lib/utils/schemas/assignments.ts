import { z } from 'zod';
import { uuidSchema, isoDateSchema } from './common';

export const assignmentPostSchema = z.object({
  shift_id: uuidSchema,
  worker_id: uuidSchema,
});

export const assignmentDeleteSchema = z.object({
  assignment_id: uuidSchema,
});

export const autofillBodySchema = z.object({
  board_id: uuidSchema,
  from_date: isoDateSchema,
  to_date: isoDateSchema,
});

const applyAssignmentItem = z.object({
  date: isoDateSchema,
  type: z.string().min(1),
  worker_id: uuidSchema,
});

export const autofillApplySchema = z.object({
  board_id: uuidSchema,
  from_date: isoDateSchema,
  to_date: isoDateSchema,
  additions: z.array(applyAssignmentItem).optional(),
  removals: z.array(applyAssignmentItem).optional(),
  assignments: z.array(applyAssignmentItem).optional(),
});
