export type Role = 'ADMIN' | 'MESERO' | 'CAJERO' | 'COCINA'
export type EstadoMesa = 'LIBRE' | 'OCUPADA' | 'CUENTA_PEDIDA' | 'CERRADA'
export type EstadoOrden = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTA' | 'ENTREGADA'
export type TipoOrden = 'COCINA' | 'CAFETERIA'
export type EstadoItem = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO'
export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'
export type PeriodoReporte = 'today' | 'week' | 'month'
export type BadgeVariant =
  | 'libre'
  | 'ocupada'
  | 'cuenta-pedida'
  | 'cerrada'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Usuario {
  id: string
  nombre: string
  email: string
  roles: Role[]
  activo: boolean
  createdAt?: string
}
export interface UsuarioResumen {
  id: string
  nombre: string
}
export interface AuthLoginResponse {
  user: Usuario
  message: string
}
export interface Producto {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  disponible: boolean
  imagenUrl?: string
  tipo: 'COMIDA' | 'BEBIDA'
}
export interface Mesa {
  id: string
  numero: number
  capacidad: number
  estado: EstadoMesa
  meseroActual?: { id: string; nombre: string }
  abiertaEn?: string
  cerradaEn?: string
}
export interface MesaResumen {
  id: string
  numero: number
}
export interface ItemOrden {
  producto: string | Producto
  cantidad: number
  notas?: string
  estadoItem: EstadoItem
}
export interface Orden {
  id: string
  mesa: string | MesaResumen
  mesero: string | UsuarioResumen
  items: ItemOrden[]
  estadoGeneral: EstadoOrden
  tipo: TipoOrden
  notaChef?: string
  tiempoEstimadoMin?: number
  temperatura?: string
  tamano?: string
  createdAt: string
}
export interface ItemFactura {
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}
export interface Factura {
  id: string
  mesa: string | MesaResumen
  itemsSnapshot: ItemFactura[]
  subtotal: number
  impuesto: number
  total: number
  metodoPago: MetodoPago
  estado: 'PENDIENTE' | 'PAGADA' | 'ANULADA'
  cajero: string | UsuarioResumen
  cai?: string
  rtn?: string
  fechaEmision: string
}
export interface PreCuentaResponse {
  mesa: { id: string; numero: number }
  ordenes: Array<{ id: string }>
  items: ItemFactura[]
  subtotal: number
  impuesto: number
  total: number
}
export interface ApiResponse<T> {
  success: true
  data: T
  timestamp: string
}
export interface ApiError {
  success: false
  statusCode: number
  message: string
  timestamp: string
  path: string
}
export interface ReporteDiario {
  fecha: string
  totalCobrado: number
  desglosePorMetodoPago: Record<MetodoPago, number>
  mesasAtendidas: number
  ticketPromedio: number
}
export interface ItemCarrito {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  notas: string
}
export interface CrearOrdenDto {
  mesaId: string
  items: Array<{ productoId: string; cantidad: number; notas?: string }>
}
export interface EmitirFacturaDto {
  mesaId: string
  metodoPago: MetodoPago
  rtn?: string
  razonSocial?: string
  cai?: string
  montoRecibido?: number
}
export interface NavItem {
  label: string
  href: string
  icon: string
  roles: Role[]
}
export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration: number
}
export interface RequestOptions {
  signal?: AbortSignal
}
