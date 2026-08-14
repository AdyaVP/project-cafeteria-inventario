import { z } from 'zod';

export const UpdateProductoSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),

  descripcion: z.string().optional(),

  precio: z.number().min(0).optional(),

  disponible: z.boolean().optional(),

  imagenUrl: z.string().optional(),
});

export type UpdateProductoDto =
  z.infer<typeof UpdateProductoSchema>;