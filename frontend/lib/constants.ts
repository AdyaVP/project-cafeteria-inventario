import type { EstadoMesa, NavItem, Role } from './types'

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'
export const LOGIN_ROUTE = '/login'
export const DASHBOARD_ROUTE = '/dashboard'
export const TOAST_DURATION_MS = 4000
export const MAX_TOASTS = 4
export const WS_NAMESPACE = '/cocina'
export const AUTH_SESSION_REVALIDATE_EVENT = 'auth-session-revalidate'
export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com/' as const
export const NEGOCIO = {
  nombre: 'Comanda Cafetería',
  rtn: '05019999123456',
  direccion: 'Tegucigalpa, Honduras',
  telefono: '+504 2222-3333',
  email: 'contacto@comanda.hn',
  cai: 'A1B2C3-D4E5F6-G7H8I9-J0K1L2-M3N4O5-P6',
  rangoDesde: '000-001-01-00000001',
  rangoHasta: '000-001-01-00099999',
  fechaLimiteCai: '31/12/2026',
  prefijoFactura: '000-001-01-',
} as const
export const WS_EVENTS = {
  connect: 'connect',
  disconnect: 'disconnect',
  mesaActualizada: 'mesa-actualizada',
  nuevaOrden: 'nueva-orden',
  ordenActualizada: 'orden-actualizada',
} as const

export const ESTADO_MESA_LABELS: Record<EstadoMesa, string> = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  CUENTA_PEDIDA: 'Cuenta Pedida',
  CERRADA: 'Cerrada',
}
export const ESTADO_MESA_BORDER: Record<EstadoMesa, string> = {
  LIBRE: 'border-t-state-success',
  OCUPADA: 'border-t-state-warning',
  CUENTA_PEDIDA: 'border-t-accent',
  CERRADA: 'border-t-border-subtle',
}
export const ESTADO_MESA_BADGE: Record<
  EstadoMesa,
  'libre' | 'ocupada' | 'cuenta-pedida' | 'cerrada'
> = {
  LIBRE: 'libre',
  OCUPADA: 'ocupada',
  CUENTA_PEDIDA: 'cuenta-pedida',
  CERRADA: 'cerrada',
}

export function getRolDefaultRoute(roles: Role[]): string {
  if (roles.includes('ADMIN')) return DASHBOARD_ROUTE
  if (roles.includes('MESERO')) return '/mesas'
  if (roles.includes('CAJERO')) return '/facturacion'
  if (roles.includes('COCINA')) return '/cocina'
  return LOGIN_ROUTE
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Panel',
    href: DASHBOARD_ROUTE,
    icon: 'LayoutDashboard',
    roles: ['ADMIN'],
  },
  {
    label: 'Mesas',
    href: '/mesas',
    icon: 'UtensilsCrossed',
    roles: ['ADMIN', 'MESERO', 'CAJERO'],
  },
  {
    label: 'Facturación',
    href: '/facturacion',
    icon: 'Receipt',
    roles: ['CAJERO'],
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: 'Users',
    roles: ['ADMIN'],
  },
  {
    label: 'Menú',
    href: '/menu',
    icon: 'BookOpen',
    roles: ['ADMIN'],
  },
  {
    label: 'Inventario',
    href: '/inventario',
    icon: 'Package',
    roles: ['ADMIN'],
  },
  {
    label: 'Reportes',
    href: '/reportes',
    icon: 'BarChart3',
    roles: ['ADMIN'],
  },
]
