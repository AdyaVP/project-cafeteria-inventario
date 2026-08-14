'use client'

import Link from 'next/link'
import { BellRing } from 'lucide-react'
import { useAuth } from '@/lib/context/AuthContext'
import { useReadyOrders } from '@/lib/context/ReadyOrdersContext'

export function ReadyOrdersStatus(): React.JSX.Element | null {
  const { usuario } = useAuth()
  const { total } = useReadyOrders()

  if (!usuario?.roles.includes('MESERO') || total === 0) return null

  return (
    <Link
      href="/mesas"
      aria-live="polite"
      className="fixed right-4 top-4 z-30 flex min-h-[44px] items-center gap-2 rounded-lg border border-state-success/40 bg-bg-overlay px-3 text-sm font-semibold text-state-success shadow-lg transition-colors hover:bg-bg-elevated lg:right-6"
    >
      <BellRing aria-hidden="true" size={17} />
      {total} {total === 1 ? 'orden lista' : 'órdenes listas'}
    </Link>
  )
}
