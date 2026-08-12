import { z } from 'zod';

import { CreateProductoComidaSchema } from './create-producto-comida.dto.js';
import { CreateProductoBebidaSchema } from './create-producto-bebida.dto.js';

// Conserva y valida los campos propios de cada tipo de producto.
export const CreateProductoSchema =
  z.discriminatedUnion('tipo', [
    CreateProductoComidaSchema,
    CreateProductoBebidaSchema,
  ]);

export type CreateProductoDto =
  z.infer<typeof CreateProductoSchema>;
