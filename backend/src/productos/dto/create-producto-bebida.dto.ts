import { z } from 'zod';

import { BaseProductoSchema } from './base-producto.dto.js';
import { ProductoTipo } from '../schemas/producto-tipo.enum.js';
import { Temperatura } from '../schemas/temperatura.enum.js';

export const CreateProductoBebidaSchema =
  BaseProductoSchema.extend({
    tipo: z.literal(ProductoTipo.BEBIDA),

    temperatura: z.enum(Temperatura),

    tamanosDisponibles: z.array(
      z.object({
        nombre: z.string(),
        precioAdicional: z.number(),
      }),
    ),
  });

export type CreateProductoBebidaDto =
  z.infer<typeof CreateProductoBebidaSchema>;