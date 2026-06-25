import { z } from 'zod';

export const CreateMesaSchema = z.object({
  numero: z
    .number()
    .int('El número de mesa debe ser un entero')
    .positive('El número de mesa debe ser mayor a 0'),

  capacidad: z
    .number()
    .int('La capacidad debe ser un entero')
    .positive('La capacidad debe ser mayor a 0'),
});

export type CreateMesaDto = z.infer<typeof CreateMesaSchema>;
