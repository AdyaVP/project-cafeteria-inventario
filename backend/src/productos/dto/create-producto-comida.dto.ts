import { z } from 'zod';

import { BaseProductoSchema } from './base-producto.dto.js';
import { ProductoTipo } from '../schemas/producto-tipo.enum.js';

export const CreateProductoComidaSchema =
  BaseProductoSchema.extend({
    tipo: z.literal(ProductoTipo.COMIDA),

    tiempoPreparacionMin: z.number().min(1),

    calorias: z.number().optional(),

    alergenos: z.array(z.string()).default([]),
  });

export type CreateProductoComidaDto =
  z.infer<typeof CreateProductoComidaSchema>;