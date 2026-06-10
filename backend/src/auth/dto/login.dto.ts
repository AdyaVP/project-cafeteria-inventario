import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof LoginSchema>;
