import { z } from 'zod';

import { Unidad } from '../schemas/unidad.enum.js';

// Validación para creación de ingredientes e insumos
export const CreateInventarioItemSchema = z.object({
  nombre: z.string().min(2).max(100),

  unidad: z.enum(Unidad),

  stockActual: z.number().min(0),

  stockMinimo: z.number().min(0),

  costoUnitario: z.number().min(0),

  activo: z.boolean().optional(),
});

export type CreateInventarioItemDto =
  z.infer<typeof CreateInventarioItemSchema>;