'use client'
import { Users } from 'lucide-react'
import clsx from 'clsx'
import {
  ESTADO_MESA_BADGE,
  ESTADO_MESA_BORDER,
  ESTADO_MESA_LABELS,
} from '@/lib/constants'
import { useTimer } from '@/lib/hooks/useTimer'
import type { Mesa } from '@/lib/types'
import { Badge } from './Badge'
import { Card } from './Card'
interface MesaCardProps {
  mesa: Mesa
  selected?: boolean
  readyOrders?: number
  onClick: () => void
}
export function MesaCard({
  mesa,
  selected = false,
  readyOrders = 0,
  onClick,
}: MesaCardProps): React.JSX.Element {
  const timer = useTimer(mesa.abiertaEn)
  return (
    <Card
      onClick={onClick}
      active={selected}
      className={clsx('border-t-[3px]', ESTADO_MESA_BORDER[mesa.estado])}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">
          Mesa {String(mesa.numero).padStart(2, '0')}
        </h3>
        <Badge
          variant={ESTADO_MESA_BADGE[mesa.estado]}
          label={ESTADO_MESA_LABELS[mesa.estado]}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Users size={14} />
          {mesa.meseroActual?.nombre ?? 'Sin asignar'}
        </span>
        <span>{timer}</span>
      </div>
      {readyOrders > 0 && (
        <div
          role="status"
          className="mt-3 rounded-md border border-state-success/40 bg-state-success/10 px-2 py-1.5 text-xs font-semibold text-state-success"
        >
          {readyOrders === 1
            ? '1 orden lista para entregar'
            : `${readyOrders} órdenes listas para entregar`}
        </div>
      )}
    </Card>
  )
}
