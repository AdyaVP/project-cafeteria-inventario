import { z } from 'zod';
import { IngredientesRecetaSchema } from './update-receta.dto.js';

export const CreateRecetaSchema = z
  .object({
    productoId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'El ID del producto no es válido'),
    ingredientes: IngredientesRecetaSchema,
  })
  .strict();

export type CreateRecetaDto = z.infer<typeof CreateRecetaSchema>;
