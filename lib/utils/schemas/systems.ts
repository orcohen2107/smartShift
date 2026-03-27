import { z } from 'zod';

export const systemPostSchema = z.object({
  name: z.string().trim().min(1, 'System name is required').max(100),
});
