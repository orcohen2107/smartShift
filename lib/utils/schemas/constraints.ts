import { z } from 'zod';
import { isoDateSchema } from './common';
import { ShiftType, ConstraintStatus } from '@/lib/utils/enums';

const shiftTypeEnum = z.nativeEnum(ShiftType);
const constraintStatusEnum = z.nativeEnum(ConstraintStatus);

export const constraintPostSchema = z.object({
  date: isoDateSchema.optional(),
  recurring: z.boolean().optional(),
  range: z.boolean().optional(),
  start_date: isoDateSchema.optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  end_date: isoDateSchema.nullable().optional(),
  range_start_date: isoDateSchema.optional(),
  range_end_date: isoDateSchema.optional(),
  range_type: z.enum(['day', 'night', 'both']).optional(),
  type: shiftTypeEnum,
  status: constraintStatusEnum.optional(),
  note: z.string().max(500).optional(),
});

export const constraintPatchSchema = z.object({
  date: isoDateSchema.optional(),
  type: shiftTypeEnum.optional(),
  status: constraintStatusEnum.optional(),
  note: z.string().max(500).nullable().optional(),
});
