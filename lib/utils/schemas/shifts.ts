import { z } from 'zod';
import { uuidSchema, isoDateSchema } from './common';
import { ShiftType } from '@/lib/utils/enums';

const shiftTypeEnum = z.nativeEnum(ShiftType);

export const shiftPostSchema = z.object({
  date: isoDateSchema,
  type: shiftTypeEnum,
  board_id: uuidSchema.optional(),
  required_count: z.number().int().min(1).optional(),
});

export const shiftPatchSchema = z.object({
  date: isoDateSchema.optional(),
  type: shiftTypeEnum.optional(),
  required_count: z.number().int().min(1).optional(),
});
