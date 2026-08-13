'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Receipt,
  Package,
  BarChart3,
  Settings,
  HelpCircle,
  Utensils,
  LogOut,
  Users,
  BookOpen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { NAV_ITEMS } from '@/lib/constants'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import type { Usuario } from '@/lib/types'

// Mapa de iconos — evita importación dinámica no type-safe
const ICON_MAP = {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Receipt,
  Package,
  BarChart3,
  Users,
  BookOpen,
} as const

type IconName = keyof typeof ICON_MAP

interface SidebarProps {
  usuario: Usuario
}

export function Sidebar({ usuario }: SidebarProps): React.JSX.Element {
  const pathname = usePathname()
  const { logout } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const handleLogout = async (): Promise<void> => {
    try {
      await logout()
      router.push('/login')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible cerrar la sesión'
      )
    }
  }

  // Filtrar items según roles del usuario
  const itemsVisibles = NAV_ITEMS.filter((item) =>
    item.roles.some((rol) => usuario.roles.includes(rol))
  )

  const puedeCrearOrden = usuario.roles.includes('MESERO')

  return (
    <aside className="hidden h-full w-[220px] flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface lg:flex">
      {/* Logo */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2">
          <Utensils size={20} className="text-accent" />
          <span className="text-lg font-bold text-text-primary">Comanda</span>
        </div>
        <p className="mt-0.5 text-[10px] text-text-secondary">Punto de venta</p>
      </div>

      {/* New Order */}
      {puedeCrearOrden && (
        <div className="px-3 pb-4 pt-2">
          <Link
            href="/mesas"
            className="inline-flex min-h-[44px] w-full min-w-[44px] items-center justify-center gap-2 rounded-md bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            + Nueva orden
          </Link>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-0.5">
          {itemsVisibles.map((item) => {
            const Icon = ICON_MAP[item.icon as IconName]
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={clsx(
                    'flex min-h-[44px] items-center gap-3 rounded-md px-3',
                    'text-sm transition-colors',
                    isActive
                      ? 'border-l-2 border-accent bg-bg-elevated pl-[10px] text-text-primary'
                      : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  )}
                >
                  {Icon && <Icon size={16} />}
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border-subtle px-2 py-2">
        <ul className="space-y-0.5">
          <li>
            <button
              onClick={handleLogout}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-sm text-state-error transition-colors hover:bg-state-error/10"
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </li>
          <li>
            <Link
              href="/settings"
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            >
              <Settings size={16} />
              <span>Configuración</span>
            </Link>
          </li>
          <li>
            <Link
              href="/support"
              className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
            >
              <HelpCircle size={16} />
              <span>Soporte</span>
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  )
}
