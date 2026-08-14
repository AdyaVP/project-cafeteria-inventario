import { z } from 'zod';

export const AnularFacturaSchema = z.object({
  justificacion: z
    .string()
    .min(10, 'La justificación debe tener al menos 10 caracteres')
    .max(500, 'La justificación no puede exceder 500 caracteres'),
});

export type AnularFacturaDto = z.infer<typeof AnularFacturaSchema>;
