import { z } from 'zod';

const MAX_MONTO = 1000000000000;

export const AbrirCajaSchema = z.object({
  fondoInicial: z
    .number()
    .min(0, 'El fondo inicial no puede ser negativo')
    .max(MAX_MONTO, 'El fondo inicial excede el límite permitido'),
});

export type AbrirCajaDto = z.infer<typeof AbrirCajaSchema>;
