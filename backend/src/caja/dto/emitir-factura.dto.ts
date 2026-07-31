import { z } from 'zod';

import { MetodoPago } from '../schemas/factura.schema.js';

export const EmitirFacturaSchema = z.object({
  mesaId: z.string().min(1, 'El ID de la mesa es requerido'),

  metodoPago: z.enum(
    [
      MetodoPago.EFECTIVO,
      MetodoPago.TARJETA,
      MetodoPago.TRANSFERENCIA,
    ] as const,
    { error: 'El método de pago es requerido' },
  ),

  rtn: z
    .string()
    .regex(/^\d{14}$/, 'El RTN debe tener 14 dígitos')
    .optional(),

  cai: z.string().min(1, 'El CAI es requerido si se provee').max(64).optional(),
});

export type EmitirFacturaDto = z.infer<typeof EmitirFacturaSchema>;
