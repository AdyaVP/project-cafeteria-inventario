import { z } from 'zod';

import { ProductoTipo } from '../schemas/producto-tipo.enum.js';

// Validación para creación de productos
export const CreateProductoSchema = z.object({
  nombre: z.string().min(2).max(100),

  descripcion: z.string().optional(),

  precio: z.number().min(0),

  disponible: z.boolean().optional(),

  imagenUrl: z.string().optional(),

  tipo: z.enum(ProductoTipo),
});

export type CreateProductoDto =
  z.infer<typeof CreateProductoSchema>;