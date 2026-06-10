import { z } from 'zod';

export enum OperacionStock {
  AGREGAR = 'AGREGAR',
  DESCONTAR = 'DESCONTAR',
}

export const UpdateStockSchema = z.object({
  cantidad: z.number().positive(),

  operacion: z.enum(OperacionStock),
});

export type UpdateStockDto =
  z.infer<typeof UpdateStockSchema>;