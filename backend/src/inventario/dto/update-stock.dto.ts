import { z } from 'zod';

import { OperacionStock } from '../schemas/operacion-stock.enum.js';

export const UpdateStockSchema = z.object({
  cantidad: z.number().positive(),

  operacion: z.enum(OperacionStock),
});

export type UpdateStockDto =
  z.infer<typeof UpdateStockSchema>;