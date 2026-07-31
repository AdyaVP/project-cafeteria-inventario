import { z } from 'zod';

import { MetodoPago } from '../schemas/factura.schema.js';

const MAX_MONTO = 1000000000000;

export const CobrarMesaSchema = z.object({
  metodoPago: z.enum(
    [
      MetodoPago.EFECTIVO,
      MetodoPago.TARJETA,
      MetodoPago.TRANSFERENCIA,
    ] as const,
    { error: 'El método de pago es requerido' },
  ),

  montoRecibido: z
    .number()
    .min(0, 'El monto recibido no puede ser negativo')
    .max(MAX_MONTO, 'El monto recibido excede el límite permitido')
    .optional(),

  propina: z
    .number()
    .min(0, 'La propina no puede ser negativa')
    .max(MAX_MONTO, 'La propina excede el límite permitido')
    .optional(),

  clienteNombre: z
    .string()
    .min(1, 'El nombre del cliente es requerido')
    .max(200)
    .optional(),

  clienteRtn: z
    .string()
    .regex(/^\d{14}$/, 'El RTN debe tener 14 dígitos')
    .optional(),
});

export type CobrarMesaDto = z.infer<typeof CobrarMesaSchema>;
