'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, UtensilsCrossed, X } from 'lucide-react'
import clsx from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { MesaCard } from '@/components/ui/MesaCard'
import { ESTADO_MESA_BADGE, ESTADO_MESA_LABELS } from '@/lib/constants'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { useMesas } from '@/lib/hooks/useMesas'
import { useOrdenes } from '@/lib/hooks/useOrdenes'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { useCurrentDate, useTimer } from '@/lib/hooks/useTimer'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import type { EstadoMesa, Mesa, Orden } from '@/lib/types'

const filters: Array<{ value: 'TODAS' | EstadoMesa; label: string }> = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'LIBRE', label: 'Libres' },
  { value: 'OCUPADA', label: 'Ocupadas' },
  { value: 'CUENTA_PEDIDA', label: 'Cuenta Pedida' },
]

export default function MesasPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN', 'MESERO', 'CAJERO'])

  if (loading || !autorizado) return null

  return <MesasContent />
}

function MesasContent(): React.JSX.Element {
  const { socket } = useWebSocket()
  const { mesas, loading, error, abrirMesa, solicitarCuenta, refetch } =
    useMesas(socket)
  const { usuario } = useAuth()
  const { toast } = useToast()
  const {
    ordenes,
    loading: ordenesLoading,
    error: ordenesError,
    getOrdenesMesa,
  } = useOrdenes()
  const router = useRouter()
  const fechaActual = useCurrentDate()
  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState<string | null>(
    null
  )
  const [filtro, setFiltro] = useState<'TODAS' | EstadoMesa>('TODAS')
  const mesaSeleccionada =
    mesas.find((mesa) => mesa.id === mesaSeleccionadaId) ?? null
  const mesasFiltradas =
    filtro === 'TODAS' ? mesas : mesas.filter((mesa) => mesa.estado === filtro)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  useEffect(() => {
    if (!mesaSeleccionadaId) return
    void getOrdenesMesa(mesaSeleccionadaId).catch((err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'Error al cargar las órdenes'
      )
    })
  }, [getOrdenesMesa, mesaSeleccionadaId, toast])

  const openTable = async (): Promise<void> => {
    if (!mesaSeleccionada) return
    try {
      await abrirMesa(mesaSeleccionada.id)
      toast.success('Mesa abierta correctamente')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir la mesa')
    }
  }

  const requestBill = async (): Promise<void> => {
    if (!mesaSeleccionada) return
    try {
      await solicitarCuenta(mesaSeleccionada.id)
      toast.success('Cuenta solicitada correctamente')
      setMesaSeleccionadaId(null)
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al solicitar la cuenta'
      )
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Mesas</h1>
        {fechaActual && (
          <span className="rounded-md bg-bg-elevated px-3 py-1 text-sm capitalize text-text-secondary">
            {fechaActual}
          </span>
        )}
        {usuario?.roles.includes('ADMIN') && (
          <Button variant="secondary" size="sm" className="ml-auto">
            + Nueva Mesa
          </Button>
        )}
      </header>

      <nav className="flex gap-5 overflow-x-auto">
        {filters.map((item) => (
          <button
            key={item.value}
            className={clsx(
              'min-h-[44px] shrink-0 pb-1 text-sm transition-colors',
              filtro === item.value
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-secondary hover:text-text-primary'
            )}
            onClick={() => setFiltro(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <MesasSkeleton />
      ) : error ? (
        <DataError message={error} onRetry={() => void refetch()} />
      ) : mesasFiltradas.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {mesasFiltradas.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              selected={mesaSeleccionadaId === mesa.id}
              onClick={() => setMesaSeleccionadaId(mesa.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<UtensilsCrossed size={40} />}
          title="Sin mesas registradas"
        />
      )}

      {mesaSeleccionada && (
        <MesaPanel
          mesa={mesaSeleccionada}
          ordenes={ordenes}
          ordenesLoading={ordenesLoading}
          ordenesError={ordenesError}
          canOrder={usuario?.roles.includes('MESERO') ?? false}
          onClose={() => setMesaSeleccionadaId(null)}
          onOpen={() => void openTable()}
          onNewOrder={() => router.push(`/mesas/${mesaSeleccionada.id}/orden`)}
          onRequestBill={() => void requestBill()}
          onRetryOrders={() => {
            void getOrdenesMesa(mesaSeleccionada.id).catch((err: unknown) =>
              toast.error(
                err instanceof Error
                  ? err.message
                  : 'Error al cargar las órdenes'
              )
            )
          }}
        />
      )}
    </div>
  )
}

function MesasSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-lg bg-bg-surface"
        />
      ))}
    </div>
  )
}

interface MesaPanelProps {
  mesa: Mesa
  ordenes: Orden[]
  ordenesLoading: boolean
  ordenesError: string | null
  canOrder: boolean
  onClose: () => void
  onOpen: () => void
  onNewOrder: () => void
  onRequestBill: () => void
  onRetryOrders: () => void
}

function MesaPanel({
  mesa,
  ordenes,
  ordenesLoading,
  ordenesError,
  canOrder,
  onClose,
  onOpen,
  onNewOrder,
  onRequestBill,
  onRetryOrders,
}: MesaPanelProps): React.JSX.Element {
  const time = useTimer(mesa.abiertaEn)
  const items = ordenes.flatMap((orden) =>
    orden.items.map((item, index) => ({
      key: `${orden.id}-${index}`,
      nombre:
        typeof item.producto === 'string'
          ? item.producto
          : item.producto.nombre,
      cantidad: item.cantidad,
    }))
  )

  return (
    <>
      <button
        aria-label="Cerrar panel"
        className="fixed inset-0 z-40 bg-bg-base/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[300px] flex-col border-l border-border-subtle bg-bg-surface p-6">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Mesa {mesa.numero}</h2>
          <Badge
            variant={ESTADO_MESA_BADGE[mesa.estado]}
            label={ESTADO_MESA_LABELS[mesa.estado]}
          />
          <Button
            aria-label="Cerrar"
            variant="ghost"
            size="sm"
            icon={<X size={17} />}
            onClick={onClose}
          />
        </header>
        <p className="mt-1 text-sm text-text-secondary">
          Capacidad: {mesa.capacidad} personas
        </p>
        <div className="mt-4 flex items-center gap-2">
          <User size={14} className="text-text-secondary" />
          <span className="text-sm font-semibold text-accent">
            {mesa.meseroActual?.nombre ?? 'Sin asignar'}
          </span>
          <span className="ml-auto text-xs text-text-secondary">{time}</span>
        </div>
        <div className="my-4 border-t border-border-subtle" />
        <p className="text-[10px] uppercase tracking-widest text-text-secondary">
          Órdenes activas
        </p>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {ordenesLoading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-6 animate-pulse rounded bg-bg-elevated"
              />
            ))
          ) : ordenesError ? (
            <DataError message={ordenesError} onRetry={onRetryOrders} />
          ) : items.length > 0 ? (
            items.map((item) => (
              <p key={item.key} className="text-sm text-text-primary">
                <span className="mr-2 text-accent">{item.cantidad}x</span>
                {item.nombre}
              </p>
            ))
          ) : (
            <EmptyState title="Sin órdenes activas" />
          )}
        </div>
        <div className="mt-auto space-y-2">
          {canOrder && mesa.estado === 'LIBRE' && (
            <Button fullWidth onClick={onOpen}>
              Abrir Mesa
            </Button>
          )}
          {canOrder && mesa.estado === 'OCUPADA' && (
            <Button fullWidth onClick={onNewOrder}>
              Tomar Nueva Orden
            </Button>
          )}
          {canOrder && mesa.estado === 'OCUPADA' && (
            <Button fullWidth variant="danger" onClick={onRequestBill}>
              Solicitar Cuenta
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}
