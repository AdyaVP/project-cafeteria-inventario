'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import clsx from 'clsx'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { useMesas } from '@/lib/hooks/useMesas'
import { useOrdenes } from '@/lib/hooks/useOrdenes'
import { useProductos } from '@/lib/hooks/useProductos'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import type { ItemCarrito, Producto } from '@/lib/types'

type MenuTab = 'todo' | 'comida' | 'bebida'
const tabs: Array<{ value: MenuTab; label: string }> = [
  { value: 'todo', label: 'Todo' },
  { value: 'comida', label: 'Comida' },
  { value: 'bebida', label: 'Bebida' },
]

const NuevaOrdenSchema = z.object({
  mesaId: z.string().min(1, 'La mesa es requerida'),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1, 'El producto es requerido'),
        cantidad: z.number().int().positive('La cantidad debe ser positiva'),
        notas: z.string().trim().max(50).optional(),
      })
    )
    .min(1, 'Agrega al menos un producto a la orden'),
})

export default function NuevaOrdenPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['MESERO'])

  if (loading || !autorizado) return null

  return <NuevaOrdenContent />
}

function NuevaOrdenContent(): React.JSX.Element {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { usuario } = useAuth()
  const {
    productos,
    comida,
    bebida,
    loading: productosLoading,
    error: productosError,
    refetch: refetchProductos,
  } = useProductos()
  const {
    mesas,
    loading: mesasLoading,
    error: mesasError,
    refetch: refetchMesas,
  } = useMesas()
  const { crearOrden } = useOrdenes()
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [tab, setTab] = useState<MenuTab>('todo')
  const [enviando, setEnviando] = useState(false)
  const mesa = mesas.find((item) => item.id === params.id)
  const productosVisibles =
    tab === 'todo' ? productos : tab === 'comida' ? comida : bebida
  const subtotal = useMemo(
    () =>
      carrito.reduce((total, item) => total + item.precio * item.cantidad, 0),
    [carrito]
  )
  const loading = productosLoading || mesasLoading
  const error = productosError ?? mesasError

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  const agregarAlCarrito = (producto: Producto): void =>
    setCarrito((current) => {
      const exists = current.some((item) => item.productoId === producto.id)
      return exists
        ? current.map((item) =>
            item.productoId === producto.id
              ? { ...item, cantidad: item.cantidad + 1 }
              : item
          )
        : [
            ...current,
            {
              productoId: producto.id,
              nombre: producto.nombre,
              precio: producto.precio,
              cantidad: 1,
              notas: '',
            },
          ]
    })

  const cambiarCantidad = (productoId: string, delta: number): void =>
    setCarrito((current) =>
      current
        .map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: item.cantidad + delta }
            : item
        )
        .filter((item) => item.cantidad > 0)
    )
  const updateNotes = (productoId: string, notas: string): void =>
    setCarrito((current) =>
      current.map((item) =>
        item.productoId === productoId ? { ...item, notas } : item
      )
    )

  const enviarOrden = async (): Promise<void> => {
    if (!mesa) return

    const result = NuevaOrdenSchema.safeParse({
      mesaId: mesa.id,
      items: carrito.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        notas: item.notas || undefined,
      })),
    })
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Revisa la orden')
      return
    }

    setEnviando(true)
    try {
      await crearOrden(result.data)
      toast.success('Orden enviada a preparación')
      router.push('/mesas')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al enviar la orden'
      )
    } finally {
      setEnviando(false)
    }
  }

  const retry = (): void => {
    void refetchProductos()
    void refetchMesas()
  }

  if (loading) return <NuevaOrdenSkeleton />
  if (error) return <DataError message={error} onRetry={retry} />
  if (!mesa)
    return (
      <EmptyState
        title="Mesa no encontrada"
        description="La mesa solicitada no existe o ya no está disponible"
      />
    )
  if (mesa.estado !== 'OCUPADA')
    return (
      <EmptyState
        title="Mesa no disponible para ordenar"
        description="La mesa debe estar abierta antes de tomar una orden."
      />
    )
  if (mesa.meseroActual?.id !== usuario?.id)
    return (
      <EmptyState
        title="Mesa asignada a otro mesero"
        description={`La mesa ${mesa.numero} está asignada a ${mesa.meseroActual?.nombre ?? 'otro mesero'}.`}
      />
    )

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[11px] text-text-secondary">
        Mesas / Mesa {mesa.numero} / Nueva Orden
      </p>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Nueva Orden — Mesa {mesa.numero}</h1>
        <Button variant="ghost" onClick={() => router.push('/mesas')}>
          Cancelar
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <section className="flex min-w-0 flex-1 flex-col">
          <nav aria-label="Categorías del menú" className="flex gap-5">
            {tabs.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={tab === item.value}
                className={clsx(
                  'min-h-[44px] pb-1 text-sm',
                  tab === item.value
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                )}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-4 grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 lg:grid-cols-3">
            {productosVisibles.length > 0 ? (
              productosVisibles.map((producto) => {
                const selected = carrito.find(
                  (item) => item.productoId === producto.id
                )
                return (
                  <button
                    key={producto.id}
                    type="button"
                    aria-pressed={Boolean(selected)}
                    className="relative min-h-24 rounded-lg border border-border-subtle bg-bg-surface p-3 text-left hover:border-border-default"
                    onClick={() => agregarAlCarrito(producto)}
                  >
                    <span className="block text-sm font-medium text-text-primary">
                      {producto.nombre}
                    </span>
                    <PriceDisplay size="sm" amount={producto.precio} />
                    {selected ? (
                      <>
                        <span className="absolute inset-0 rounded-lg bg-accent/10" />
                        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">
                          {selected.cantidad}
                        </span>
                      </>
                    ) : (
                      <Plus
                        size={18}
                        className="absolute bottom-2 right-2 text-text-disabled"
                      />
                    )}
                  </button>
                )
              })
            ) : (
              <div className="col-span-full">
                <EmptyState title="Sin productos disponibles" />
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-[400px] w-full shrink-0 flex-col rounded-lg bg-bg-surface p-4 lg:w-[360px]">
          <header className="flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-widest text-text-secondary">
              Orden actual
            </h2>
            <span className="flex h-5 min-w-5 items-center justify-center rounded bg-bg-elevated px-1.5 text-xs text-accent">
              {carrito.reduce((total, item) => total + item.cantidad, 0)}
            </span>
          </header>
          {carrito.length === 0 ? (
            <EmptyState title="Agrega productos" />
          ) : (
            <div className="mt-3 flex-1 space-y-4 overflow-y-auto">
              {carrito.map((item) => (
                <div key={item.productoId} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-sm font-medium">{item.nombre}</span>
                    <PriceDisplay
                      size="sm"
                      amount={item.precio * item.cantidad}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label="Reducir cantidad"
                      variant="ghost"
                      size="sm"
                      onClick={() => cambiarCantidad(item.productoId, -1)}
                    >
                      −
                    </Button>
                    <span className="font-mono text-sm">{item.cantidad}</span>
                    <Button
                      aria-label="Aumentar cantidad"
                      variant="ghost"
                      size="sm"
                      onClick={() => cambiarCantidad(item.productoId, 1)}
                    >
                      +
                    </Button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={50}
                      aria-label={`Nota para ${item.nombre}`}
                      placeholder="Nota para cocina..."
                      className="w-full border-b border-border-subtle bg-transparent py-1 pr-12 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none"
                      value={item.notas}
                      onChange={(event) =>
                        updateNotes(item.productoId, event.target.value)
                      }
                    />
                    <span
                      className={clsx(
                        'absolute bottom-1 right-0 text-[10px]',
                        item.notas.length >= 50
                          ? 'text-state-error'
                          : item.notas.length >= 45
                            ? 'text-state-warning'
                            : 'text-text-disabled'
                      )}
                    >
                      {item.notas.length}/50
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="my-3 border-t border-border-subtle" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Subtotal</span>
            <PriceDisplay size="lg" variant="accent" amount={subtotal} />
          </div>
          <Button
            fullWidth
            size="lg"
            className="mt-3"
            disabled={carrito.length === 0 || enviando}
            loading={enviando}
            onClick={() => void enviarOrden()}
          >
            ▶ Enviar Orden
          </Button>
        </aside>
      </div>
    </div>
  )
}

function NuevaOrdenSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-lg bg-bg-surface"
        />
      ))}
    </div>
  )
}
