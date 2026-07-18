import { z } from 'zod';

export const BaseProductoSchema = z.object({
  nombre: z.string().min(2).max(100),

  descripcion: z.string().optional(),

  precio: z.number().min(0),

  disponible: z.boolean().optional(),

  imagenUrl: z.string().optional(),
});