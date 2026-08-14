'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { User, UtensilsCrossed, X } from 'lucide-react'
import clsx from 'clsx'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { MesaCard } from '@/components/ui/MesaCard'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { mesasApi } from '@/lib/api/mesas'
import { ordenesApi } from '@/lib/api/ordenes'
import {
  ESTADO_MESA_BADGE,
  ESTADO_MESA_LABELS,
  WS_EVENTS,
} from '@/lib/constants'
import { useAuth } from '@/lib/context/AuthContext'
import { useReadyOrders } from '@/lib/context/ReadyOrdersContext'
import { useToast } from '@/lib/context/ToastContext'
import { useMesas } from '@/lib/hooks/useMesas'
import { useOrdenes } from '@/lib/hooks/useOrdenes'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { useCurrentDate, useTimer } from '@/lib/hooks/useTimer'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import type {
  BadgeVariant,
  EstadoMesa,
  EstadoOrden,
  Mesa,
  Orden,
  TipoOrden,
} from '@/lib/types'

const filters: Array<{ value: 'TODAS' | EstadoMesa; label: string }> = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'LIBRE', label: 'Libres' },
  { value: 'OCUPADA', label: 'Ocupadas' },
  { value: 'CUENTA_PEDIDA', label: 'Cuenta Pedida' },
]

const CrearMesaSchema = z.object({
  numero: z.coerce
    .number<number>({ error: 'Ingresa el número de mesa' })
    .int('El número debe ser entero')
    .positive('El número debe ser mayor a cero'),
  capacidad: z.coerce
    .number<number>({ error: 'Ingresa la capacidad' })
    .int('La capacidad debe ser entera')
    .positive('La capacidad debe ser mayor a cero'),
})

interface CrearMesaErrors {
  numero?: string
  capacidad?: string
}

const ESTADO_ORDEN_LABELS: Record<EstadoOrden, string> = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  LISTA: 'Lista para entregar',
  ENTREGADA: 'Entregada',
}

const ESTADO_ORDEN_BADGE: Record<EstadoOrden, BadgeVariant> = {
  PENDIENTE: 'warning',
  EN_PREPARACION: 'info',
  LISTA: 'success',
  ENTREGADA: 'success',
}

const TIPO_ORDEN_LABELS: Record<TipoOrden, string> = {
  COCINA: 'Comida',
  CAFETERIA: 'Bebida',
}

interface OrdenActualizadaEvent {
  ordenId: string
  mesaId: string
  mesaNumero: number
  meseroId: string
  tipo: TipoOrden
  nuevoEstado: Extract<EstadoOrden, 'EN_PREPARACION' | 'LISTA'>
  timestamp: string
}

function isOrdenActualizadaEvent(
  payload: unknown
): payload is OrdenActualizadaEvent {
  if (typeof payload !== 'object' || payload === null) return false

  const event = payload as Record<string, unknown>
  return (
    typeof event.ordenId === 'string' &&
    typeof event.mesaId === 'string' &&
    typeof event.mesaNumero === 'number' &&
    typeof event.meseroId === 'string' &&
    (event.tipo === 'COCINA' || event.tipo === 'CAFETERIA') &&
    (event.nuevoEstado === 'EN_PREPARACION' || event.nuevoEstado === 'LISTA') &&
    typeof event.timestamp === 'string'
  )
}

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
  const { descartarOrden, totalPorMesa } = useReadyOrders()
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
  const [ordenEntregandoId, setOrdenEntregandoId] = useState<string | null>(
    null
  )
  const [crearMesaOpen, setCrearMesaOpen] = useState(false)
  const [numeroMesa, setNumeroMesa] = useState('')
  const [capacidadMesa, setCapacidadMesa] = useState('4')
  const [crearMesaErrors, setCrearMesaErrors] = useState<CrearMesaErrors>({})
  const [creandoMesa, setCreandoMesa] = useState(false)
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

  useEffect(() => {
    if (!socket) return

    const handleOrdenActualizada = (payload: unknown): void => {
      if (!isOrdenActualizadaEvent(payload)) return

      if (payload.mesaId === mesaSeleccionadaId) {
        void getOrdenesMesa(payload.mesaId).catch((err: unknown) => {
          toast.error(
            err instanceof Error
              ? err.message
              : 'Error al actualizar las órdenes de la mesa'
          )
        })
      }
    }

    socket.on(WS_EVENTS.ordenActualizada, handleOrdenActualizada)
    return () => {
      socket.off(WS_EVENTS.ordenActualizada, handleOrdenActualizada)
    }
  }, [getOrdenesMesa, mesaSeleccionadaId, socket, toast])

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

  const deliverOrder = async (ordenId: string): Promise<void> => {
    if (!mesaSeleccionada) return

    const mesaId = mesaSeleccionada.id
    setOrdenEntregandoId(ordenId)
    try {
      await ordenesApi.entregarOrden(ordenId)
      descartarOrden(ordenId)
      toast.success('Orden entregada correctamente')
      try {
        await getOrdenesMesa(mesaId)
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'La orden se entregó, pero no se pudo actualizar la mesa'
        )
      }
    } catch (err: unknown) {
      try {
        await getOrdenesMesa(mesaId)
      } catch {
        // Conserva el error original de la acción; el usuario puede reintentar.
      }
      toast.error(
        err instanceof Error ? err.message : 'Error al entregar la orden'
      )
    } finally {
      setOrdenEntregandoId(null)
    }
  }

  const createTable = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    const result = CrearMesaSchema.safeParse({
      numero: numeroMesa,
      capacidad: capacidadMesa,
    })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setCrearMesaErrors({
        numero: fields.numero?.[0],
        capacidad: fields.capacidad?.[0],
      })
      return
    }

    setCreandoMesa(true)
    setCrearMesaErrors({})
    try {
      await mesasApi.crearMesa(result.data)
      await refetch()
      toast.success(`Mesa ${result.data.numero} creada correctamente`)
      setNumeroMesa('')
      setCapacidadMesa('4')
      setCrearMesaOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la mesa')
    } finally {
      setCreandoMesa(false)
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
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => setCrearMesaOpen(true)}
          >
            + Nueva Mesa
          </Button>
        )}
      </header>

      <nav aria-label="Filtrar mesas" className="flex gap-5 overflow-x-auto">
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            aria-pressed={filtro === item.value}
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
              readyOrders={totalPorMesa(mesa.id)}
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
          canManage={
            usuario?.roles.includes('MESERO') === true &&
            mesaSeleccionada.meseroActual?.id === usuario.id
          }
          ordenEntregandoId={ordenEntregandoId}
          onClose={() => setMesaSeleccionadaId(null)}
          onOpen={() => void openTable()}
          onNewOrder={() => router.push(`/mesas/${mesaSeleccionada.id}/orden`)}
          onRequestBill={() => void requestBill()}
          onDeliverOrder={(ordenId) => void deliverOrder(ordenId)}
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

      <Modal
        open={crearMesaOpen}
        onClose={() => setCrearMesaOpen(false)}
        title="Nueva mesa"
        description="Registra una mesa física para que aparezca en el canvas."
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void createTable(event)}
          noValidate
        >
          <Input
            name="numero"
            label="Número de mesa"
            type="number"
            min="1"
            inputMode="numeric"
            value={numeroMesa}
            error={crearMesaErrors.numero}
            onChange={(event) => setNumeroMesa(event.target.value)}
            autoFocus
          />
          <Input
            name="capacidad"
            label="Capacidad"
            type="number"
            min="1"
            inputMode="numeric"
            value={capacidadMesa}
            error={crearMesaErrors.capacidad}
            onChange={(event) => setCapacidadMesa(event.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCrearMesaOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={creandoMesa}>
              Crear mesa
            </Button>
          </div>
        </form>
      </Modal>
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
  canManage: boolean
  ordenEntregandoId: string | null
  onClose: () => void
  onOpen: () => void
  onNewOrder: () => void
  onRequestBill: () => void
  onDeliverOrder: (ordenId: string) => void
  onRetryOrders: () => void
}

function MesaPanel({
  mesa,
  ordenes,
  ordenesLoading,
  ordenesError,
  canOrder,
  canManage,
  ordenEntregandoId,
  onClose,
  onOpen,
  onNewOrder,
  onRequestBill,
  onDeliverOrder,
  onRetryOrders,
}: MesaPanelProps): React.JSX.Element {
  const time = useTimer(mesa.abiertaEn)

  return (
    <>
      <button
        type="button"
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
          ) : ordenes.length > 0 ? (
            ordenes.map((orden) => (
              <article
                key={orden.id}
                className="space-y-3 rounded-lg border border-border-subtle bg-bg-base p-3"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      Orden #{orden.id.slice(-6)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary">
                      {TIPO_ORDEN_LABELS[orden.tipo]}
                    </p>
                  </div>
                  <Badge
                    variant={ESTADO_ORDEN_BADGE[orden.estadoGeneral]}
                    label={ESTADO_ORDEN_LABELS[orden.estadoGeneral]}
                    pulse={orden.estadoGeneral === 'LISTA'}
                  />
                </header>
                <div className="space-y-1">
                  {orden.items.map((item, index) => (
                    <p
                      key={`${orden.id}-${index}`}
                      className="text-sm text-text-primary"
                    >
                      <span className="mr-2 text-accent">{item.cantidad}x</span>
                      {typeof item.producto === 'string'
                        ? item.producto
                        : item.producto.nombre}
                    </p>
                  ))}
                </div>
                {canManage && orden.estadoGeneral === 'LISTA' && (
                  <Button
                    fullWidth
                    size="sm"
                    loading={ordenEntregandoId === orden.id}
                    onClick={() => onDeliverOrder(orden.id)}
                  >
                    Entregar
                  </Button>
                )}
              </article>
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
          {canManage && mesa.estado === 'OCUPADA' && (
            <Button fullWidth onClick={onNewOrder}>
              Tomar Nueva Orden
            </Button>
          )}
          {canManage && mesa.estado === 'OCUPADA' && (
            <Button
              fullWidth
              variant="danger"
              disabled={
                ordenesLoading || ordenesError !== null || ordenes.length > 0
              }
              onClick={onRequestBill}
            >
              Solicitar Cuenta
            </Button>
          )}
          {canManage &&
            mesa.estado === 'OCUPADA' &&
            !ordenesLoading &&
            ordenes.length > 0 && (
              <p className="text-center text-xs text-text-secondary">
                Entrega todas las órdenes antes de solicitar la cuenta.
              </p>
            )}
          {canOrder &&
            !canManage &&
            mesa.estado !== 'LIBRE' &&
            mesa.meseroActual && (
              <p className="text-center text-xs text-text-secondary">
                Esta mesa está asignada a {mesa.meseroActual.nombre}.
              </p>
            )}
        </div>
      </aside>
    </>
  )
}
