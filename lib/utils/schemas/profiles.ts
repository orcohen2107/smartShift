import { z } from 'zod';

export const promoteSchema = z.object({
  role: z.enum(['manager', 'commander']).optional(),
});
