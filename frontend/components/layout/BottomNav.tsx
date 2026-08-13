'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
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
}
export function BottomNav({ navItems }: BottomNavProps): React.JSX.Element {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border-subtle bg-bg-surface lg:hidden">
      {navItems.slice(0, 4).map((item) => {
        const Icon = icons[item.icon] ?? LayoutDashboard
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px]',
              active ? 'text-accent' : 'text-text-disabled'
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
