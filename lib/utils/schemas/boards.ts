import { z } from 'zod';

export const boardPostSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required').max(100),
  workers_per_shift: z.number().int().min(1).optional(),
  single_person_for_day: z.boolean().optional(),
});
