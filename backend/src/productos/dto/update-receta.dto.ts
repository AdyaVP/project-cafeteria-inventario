import { z } from 'zod';

const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'El ID del insumo no es válido');

export const IngredienteRecetaSchema = z
  .object({
    inventarioItemId: ObjectIdSchema,
    cantidad: z
      .number()
      .finite('La cantidad debe ser un número finito')
      .min(0.01, 'La cantidad mínima es 0.01'),
  })
  .strict();

export const IngredientesRecetaSchema = z
  .array(IngredienteRecetaSchema)
  .min(1, 'La receta debe tener al menos un ingrediente')
  .max(100, 'La receta no puede tener más de 100 ingredientes')
  .superRefine((ingredientes, context) => {
    const seen = new Set<string>();

    ingredientes.forEach((ingrediente, index) => {
      if (seen.has(ingrediente.inventarioItemId)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'inventarioItemId'],
          message: 'No se puede repetir un insumo en la receta',
        });
      }
      seen.add(ingrediente.inventarioItemId);
    });
  });

export const UpdateRecetaSchema = z
  .object({
    ingredientes: IngredientesRecetaSchema,
  })
  .strict();

export type UpdateRecetaDto = z.infer<typeof UpdateRecetaSchema>;
