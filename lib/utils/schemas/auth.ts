import { z } from 'zod';
import { uuidSchema } from './common';

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  full_name: z.string().min(1).max(100).optional(),
  system_id: uuidSchema.optional(),
  is_reserves: z.boolean().optional(),
  user_type: z.enum(['worker', 'worker_reserves', 'guest']).optional(),
});
