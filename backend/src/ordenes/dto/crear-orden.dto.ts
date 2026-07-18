import { z } from 'zod';

export const CrearOrdenSchema = z.object({
  mesaId: z.string().min(1, 'El ID de la mesa es requerido'),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1, 'El ID del producto es requerido'),
        cantidad: z
          .number()
          .int()
          .positive('La cantidad debe ser mayor a 0'),
        notas: z.string().optional(),
      }),
    )
    .min(1, 'Debe haber al menos un producto en la orden'),
});

export type CrearOrdenDto = z.infer<typeof CrearOrdenSchema>;
