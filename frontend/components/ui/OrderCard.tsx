'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { useTimer } from '@/lib/hooks/useTimer'
import type { BadgeVariant, Orden, TipoOrden } from '@/lib/types'
import { Badge } from './Badge'
import { Button } from './Button'

const TIPO_ORDEN_LABELS: Record<TipoOrden, string> = {
  COCINA: 'Comida',
  CAFETERIA: 'Bebida',
}

const TIPO_ORDEN_BADGE: Record<TipoOrden, BadgeVariant> = {
  COCINA: 'warning',
  CAFETERIA: 'info',
}

interface OrderCardProps {
  orden: Orden
  onAction?: (ordenId: string) => void
  actionLabel?: string
  actionVariant?: 'primary' | 'secondary' | 'ghost'
  showTimer?: boolean
  loading?: boolean
}
export function OrderCard({
  orden,
  onAction,
  actionLabel,
  actionVariant = 'primary',
  showTimer = true,
  loading = false,
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
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{mesa}</h3>
          <Badge
            variant={TIPO_ORDEN_BADGE[orden.tipo]}
            label={TIPO_ORDEN_LABELS[orden.tipo]}
          />
        </div>
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
      {orden.tiempoEstimadoMin !== undefined && (
        <p className="mt-1 text-xs text-text-secondary">
          Estimado: {orden.tiempoEstimadoMin} min
        </p>
      )}
      <ul className="my-3 space-y-2">
        {orden.items.map((item, index) => (
          <li key={`${orden.id}-${index}`} className="text-sm">
            <p>
              <span className="mr-2 font-bold text-accent">
                {item.cantidad}x
              </span>
              {typeof item.producto === 'string'
                ? item.producto
                : item.producto.nombre}
            </p>
            {item.notas && (
              <p className="mt-1 line-clamp-2 break-words rounded bg-state-warning/10 px-2 py-1 text-xs text-state-warning">
                Nota: {item.notas}
              </p>
            )}
          </li>
        ))}
      </ul>
      {orden.notaChef && (
        <div className="mb-3 flex gap-2 rounded bg-bg-overlay p-2 text-sm italic text-state-warning">
          <AlertTriangle size={16} className="shrink-0" />
          <p className="line-clamp-2 break-words">{orden.notaChef}</p>
        </div>
      )}
      {actionLabel && onAction && (
        <Button
          fullWidth
          variant={actionVariant}
          loading={loading}
          onClick={() => onAction(orden.id)}
        >
          {actionLabel}
        </Button>
      )}
    </article>
  )
}
