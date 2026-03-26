import { z } from 'zod';

export const workerPostSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(100),
});
