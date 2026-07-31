import { z } from 'zod';

export const AnularFacturaSchema = z.object({
  motivo: z
    .string()
    .min(10, 'El motivo debe tener al menos 10 caracteres')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
});

export type AnularFacturaDto = z.infer<typeof AnularFacturaSchema>;
