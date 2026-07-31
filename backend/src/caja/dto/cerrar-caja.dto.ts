import { z } from 'zod';

const MAX_MONTO = 1000000000000;

export const CerrarCajaSchema = z.object({
  totalReal: z
    .number()
    .min(0, 'El total real no puede ser negativo')
    .max(MAX_MONTO, 'El total real excede el límite permitido'),
});

export type CerrarCajaDto = z.infer<typeof CerrarCajaSchema>;
