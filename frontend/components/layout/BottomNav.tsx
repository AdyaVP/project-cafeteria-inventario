'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import type { NavItem } from '@/lib/types'
interface BottomNavProps {
  navItems: NavItem[]
}
const icons: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Receipt,
  Package,
  BarChart3,
  Users,
  BookOpen,
}
export function BottomNav({ navItems }: BottomNavProps): React.JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const { toast } = useToast()

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

  const utilityItems = [
    { href: '/settings', label: 'Configuración', Icon: Settings },
    { href: '/support', label: 'Soporte', Icon: HelpCircle },
  ]

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border-subtle bg-bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {navItems.map((item) => {
        const Icon = icons[item.icon] ?? LayoutDashboard
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex min-h-[64px] min-w-[72px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px]',
              active ? 'text-accent' : 'text-text-disabled'
            )}
          >
            <Icon aria-hidden="true" size={18} />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        )
      })}
      {utilityItems.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex min-h-[64px] min-w-[82px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px]',
              active ? 'text-accent' : 'text-text-disabled'
            )}
          >
            <Icon aria-hidden="true" size={18} />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        className="flex min-h-[64px] min-w-[72px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] text-state-error"
        onClick={() => void handleLogout()}
      >
        <LogOut aria-hidden="true" size={18} />
        <span>Cerrar sesión</span>
      </button>
    </nav>
  )
}
