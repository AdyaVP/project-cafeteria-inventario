import { z } from 'zod'

export const UsuarioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  email: z.string().email(),
  roles: z.array(z.enum(['ADMIN', 'MESERO', 'CAJERO', 'COCINA'])),
  activo: z.boolean(),
  createdAt: z.string().optional(),
})
export const AuthLoginResponseSchema = z.object({
  user: UsuarioSchema,
  message: z.string(),
})
const UsuarioResumenSchema = z.object({ id: z.string(), nombre: z.string() })
export const MesaSchema = z.object({
  id: z.string(),
  numero: z.number(),
  capacidad: z.number(),
  estado: z.enum(['LIBRE', 'OCUPADA', 'CUENTA_PEDIDA', 'CERRADA']),
  meseroActual: z
    .object({ id: z.string(), nombre: z.string() })
    .nullish()
    .transform((value) => value ?? undefined),
  abiertaEn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  cerradaEn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
})
const MesaResumenSchema = z.object({ id: z.string(), numero: z.number() })
export const ProductoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  precio: z.number(),
  disponible: z.boolean(),
  tipo: z.enum(['COMIDA', 'BEBIDA']),
  descripcion: z.string().optional(),
  imagenUrl: z.string().optional(),
})
export const ItemFacturaSchema = z.object({
  nombre: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  subtotal: z.number(),
})
export const PreCuentaSchema = z.object({
  mesa: z.object({ id: z.string(), numero: z.number() }),
  ordenes: z.array(z.object({ id: z.string() })),
  items: z.array(ItemFacturaSchema),
  subtotal: z.number(),
  impuesto: z.number(),
  total: z.number(),
})
export const ReporteDiarioSchema = z.object({
  fecha: z.string(),
  totalCobrado: z.number(),
  desglosePorMetodoPago: z.object({
    EFECTIVO: z.number(),
    TARJETA: z.number(),
    TRANSFERENCIA: z.number(),
  }),
  mesasAtendidas: z.number(),
  ticketPromedio: z.number(),
})
const OrdenItemSchema = z
  .object({
    nombreProducto: z.string(),
    cantidad: z.number(),
    notas: z.string().optional(),
    estadoItem: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']),
  })
  .transform((item) => ({
    producto: item.nombreProducto,
    cantidad: item.cantidad,
    notas: item.notas,
    estadoItem: item.estadoItem,
  }))
export const OrdenSchema = z.object({
  id: z.string(),
  mesa: z.union([z.string(), MesaResumenSchema]),
  mesero: z.union([z.string(), UsuarioResumenSchema]),
  estadoGeneral: z.enum(['PENDIENTE', 'EN_PREPARACION', 'LISTA', 'ENTREGADA']),
  tipo: z.enum(['COCINA', 'CAFETERIA']),
  items: z.array(OrdenItemSchema),
  notaChef: z.string().optional(),
  tiempoEstimadoMin: z.number().optional(),
  temperatura: z.string().optional(),
  tamano: z.string().optional(),
  createdAt: z.string(),
})
export const FacturaSchema = z.object({
  id: z.string(),
  mesa: z.union([z.string(), MesaResumenSchema]),
  itemsSnapshot: z.array(ItemFacturaSchema),
  subtotal: z.number(),
  impuesto: z.number(),
  total: z.number(),
  metodoPago: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']),
  estado: z.enum(['PENDIENTE', 'PAGADA', 'ANULADA']),
  cajero: z.union([z.string(), UsuarioResumenSchema]),
  cai: z.string().optional(),
  rtn: z.string().optional(),
  fechaEmision: z.string(),
})
