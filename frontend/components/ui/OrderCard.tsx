'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { useTimer } from '@/lib/hooks/useTimer'
import type { Orden } from '@/lib/types'
import { Button } from './Button'
interface OrderCardProps {
  orden: Orden
  onAction?: (ordenId: string) => void
  actionLabel?: string
  actionVariant?: 'primary' | 'secondary' | 'ghost'
  showTimer?: boolean
}
export function OrderCard({
  orden,
  onAction,
  actionLabel,
  actionVariant = 'primary',
  showTimer = true,
}: OrderCardProps): React.JSX.Element {
  const timer = useTimer(orden.createdAt)
  const [overdue, setOverdue] = useState(false)
  const mesa =
    typeof orden.mesa === 'string'
      ? `Mesa ${orden.mesa}`
      : `Mesa ${orden.mesa.numero}`

  useEffect(() => {
    const update = (): void =>
      setOverdue(
        orden.tiempoEstimadoMin !== undefined &&
          (Date.now() - new Date(orden.createdAt).getTime()) / 60000 >
            orden.tiempoEstimadoMin
      )
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [orden.createdAt, orden.tiempoEstimadoMin])

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold">{mesa}</h3>
        {showTimer && (
          <span
            className={clsx(
              'flex items-center gap-1 text-xs text-text-secondary',
              overdue && 'text-state-error'
            )}
          >
            {overdue && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-state-error" />
            )}
            {timer}
          </span>
        )}
      </header>
      <p className="mt-1 text-sm text-text-secondary">
        Ticket #{orden.id.slice(-6)}
      </p>
      <ul className="my-3 space-y-1">
        {orden.items.map((item, index) => (
          <li key={`${orden.id}-${index}`} className="text-sm">
            <span className="mr-2 font-bold text-accent">{item.cantidad}x</span>
            {typeof item.producto === 'string'
              ? item.producto
              : item.producto.nombre}
          </li>
        ))}
      </ul>
      {orden.notaChef && (
        <div className="mb-3 flex gap-2 rounded bg-bg-overlay p-2 text-sm italic text-state-warning">
          <AlertTriangle size={16} className="shrink-0" />
          {orden.notaChef}
        </div>
      )}
      {actionLabel && onAction && (
        <Button
          fullWidth
          variant={actionVariant}
          onClick={() => onAction(orden.id)}
        >
          {actionLabel}
        </Button>
      )}
    </article>
  )
}
