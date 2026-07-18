import { z } from 'zod';

export const CreateRecetaSchema = z.object({
  productoId: z.string(),

  ingredientes: z.array(
    z.object({
      inventarioItemId: z.string(),
      cantidad: z.number().positive(),
    }),
  ),
});

export type CreateRecetaDto =
  z.infer<typeof CreateRecetaSchema>;