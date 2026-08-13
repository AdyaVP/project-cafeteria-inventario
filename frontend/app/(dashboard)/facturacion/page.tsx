'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Clock, Receipt } from 'lucide-react'
import clsx from 'clsx'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { useToast } from '@/lib/context/ToastContext'
import { useFacturacion } from '@/lib/hooks/useFacturacion'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { useTimer } from '@/lib/hooks/useTimer'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import type { Mesa, MetodoPago } from '@/lib/types'

const paymentMethods: Array<{ label: string; value: MetodoPago }> = [
  { label: 'EFECTIVO', value: 'EFECTIVO' },
  { label: 'TARJETA', value: 'TARJETA' },
  { label: 'TRANSF.', value: 'TRANSFERENCIA' },
]

const FacturacionFormSchema = z
  .object({
    metodoPago: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'], {
      error: 'Selecciona un método de pago',
    }),
    montoRecibido: z.string(),
    rtn: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || /^\d{14}$/.test(value),
        'El RTN debe tener 14 dígitos'
      ),
    cai: z.string().trim().max(64, 'El CAI no puede exceder 64 caracteres'),
  })
  .superRefine((data, context) => {
    if (data.metodoPago !== 'EFECTIVO') return

    const amount = Number(data.montoRecibido)
    if (!data.montoRecibido.trim() || !Number.isFinite(amount)) {
      context.addIssue({
        code: 'custom',
        path: ['montoRecibido'],
        message: 'Ingresa el monto recibido',
      })
    }
  })

interface FacturacionFormErrors {
  metodoPago?: string
  montoRecibido?: string
  rtn?: string
  cai?: string
}

export default function FacturacionPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['CAJERO'])

  if (loading || !autorizado) return null

  return <FacturacionContent />
}

function FacturacionContent(): React.JSX.Element {
  const { socket } = useWebSocket()
  const {
    mesasPendientes,
    mesaSeleccionada,
    preCuenta,
    loading,
    error,
    seleccionarMesa,
    emitirFactura,
    refetch,
  } = useFacturacion(socket)
  const { toast } = useToast()
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null)
  const [montoRecibido, setMontoRecibido] = useState('')
  const [rtn, setRtn] = useState('')
  const [cai, setCai] = useState('')
  const [formErrors, setFormErrors] = useState<FacturacionFormErrors>({})
  const [emitiendo, setEmitiendo] = useState(false)
  const [facturaEmitidaId, setFacturaEmitidaId] = useState<string | null>(null)
  const cambio =
    metodoPago === 'EFECTIVO' && montoRecibido
      ? Number.parseFloat(montoRecibido) - (preCuenta?.total ?? 0)
      : null
  const porcentajeImpuesto =
    preCuenta && preCuenta.subtotal > 0
      ? ((preCuenta.impuesto / preCuenta.subtotal) * 100).toFixed(0)
      : '—'

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  useEffect(() => {
    setMetodoPago(null)
    setMontoRecibido('')
    setRtn('')
    setCai('')
    setFormErrors({})
  }, [mesaSeleccionada?.id])

  const select = async (mesa: Mesa): Promise<void> => {
    try {
      await seleccionarMesa(mesa)
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al cargar la cuenta'
      )
    }
  }

  const retry = (): void => {
    if (mesaSeleccionada) {
      void select(mesaSeleccionada)
      return
    }
    void refetch()
  }

  const handleEmitir = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    if (!mesaSeleccionada || !preCuenta) return

    const result = FacturacionFormSchema.safeParse({
      metodoPago,
      montoRecibido,
      rtn,
      cai,
    })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setFormErrors({
        metodoPago: fields.metodoPago?.[0],
        montoRecibido: fields.montoRecibido?.[0],
        rtn: fields.rtn?.[0],
        cai: fields.cai?.[0],
      })
      return
    }

    const amount = Number(result.data.montoRecibido)
    if (result.data.metodoPago === 'EFECTIVO' && amount < preCuenta.total) {
      setFormErrors({
        montoRecibido: 'El monto no cubre el total de la cuenta',
      })
      return
    }

    setFormErrors({})
    setEmitiendo(true)
    try {
      const factura = await emitirFactura({
        mesaId: mesaSeleccionada.id,
        metodoPago: result.data.metodoPago,
        rtn: result.data.rtn || undefined,
        cai: result.data.cai || undefined,
      })
      setFacturaEmitidaId(factura.id)
      toast.success('Factura emitida y mesa liberada correctamente')
      setMetodoPago(null)
      setMontoRecibido('')
      setRtn('')
      setCai('')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al emitir la factura'
      )
    } finally {
      setEmitiendo(false)
    }
  }

  if (loading && mesasPendientes.length === 0) return <FacturacionSkeleton />
  if (error && !mesaSeleccionada)
    return <DataError message={error} onRetry={retry} />

  return (
    <div className="relative -m-4 flex min-h-[calc(100dvh-5rem)] flex-col md:-m-6 lg:h-[calc(100%+3rem)] lg:min-h-0 lg:flex-row lg:overflow-hidden">
      {facturaEmitidaId && (
        <div
          role="status"
          className="fixed inset-x-4 top-4 z-20 flex items-center justify-between gap-3 rounded-lg border border-state-success/40 bg-bg-overlay px-4 py-3 shadow-lg sm:absolute sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <span className="text-sm text-state-success">
            Factura #{facturaEmitidaId.slice(-6)} emitida · mesa liberada
          </span>
          <button
            type="button"
            className="min-h-[44px] text-xs text-text-secondary hover:text-text-primary"
            onClick={() => setFacturaEmitidaId(null)}
          >
            Cerrar
          </button>
        </div>
      )}
      <aside className="flex max-h-56 w-full shrink-0 flex-col border-b border-border-subtle bg-bg-surface lg:max-h-none lg:w-[300px] lg:border-b-0 lg:border-r">
        <header className="border-b border-border-subtle p-4 text-[10px] uppercase tracking-widest text-text-secondary">
          Mesas con cuenta pendiente
        </header>
        <div className="flex-1 overflow-y-auto">
          {mesasPendientes.length === 0 ? (
            <EmptyState title="Sin cuentas pendientes" />
          ) : (
            mesasPendientes.map((mesa) => (
              <PendingMesa
                key={mesa.id}
                mesa={mesa}
                active={mesaSeleccionada?.id === mesa.id}
                amount={
                  mesaSeleccionada?.id === mesa.id
                    ? preCuenta?.total
                    : undefined
                }
                onClick={() => void select(mesa)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[28rem] min-w-0 flex-1 flex-col overflow-y-auto lg:min-h-0">
        {!mesaSeleccionada ? (
          <EmptyState
            icon={<Receipt size={48} />}
            title="Selecciona una mesa para facturar"
          />
        ) : error ? (
          <DataError message={error} onRetry={retry} />
        ) : loading || !preCuenta ? (
          <PreCuentaSkeleton />
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-5 sm:px-6 sm:pt-6">
              <h1 className="font-bold">
                Mesa {mesaSeleccionada.numero} — Facturación
              </h1>
              <Badge variant="cuenta-pedida" label="Cuenta pedida" />
            </header>
            <h2 className="mt-6 px-4 text-[10px] uppercase tracking-widest text-text-secondary sm:px-6">
              Detalle de consumo
            </h2>
            <div className="mt-2 overflow-x-auto px-4 sm:px-6">
              {preCuenta.items.length > 0 ? (
                <table className="w-full min-w-[34rem]">
                  <thead>
                    <tr className="border-b border-border-subtle text-[11px] uppercase text-text-secondary">
                      <th className="pb-2 text-left font-medium">Ítem</th>
                      <th className="pb-2 text-center font-medium">Cant</th>
                      <th className="pb-2 text-right font-medium">Precio</th>
                      <th className="pb-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preCuenta.items.map((item, index) => (
                      <tr
                        key={`${item.nombre}-${index}`}
                        className="border-b border-border-subtle/50"
                      >
                        <td className="py-2 text-sm">{item.nombre}</td>
                        <td className="py-2 text-center font-mono text-sm">
                          {item.cantidad}
                        </td>
                        <td className="py-2 text-right">
                          <PriceDisplay
                            size="sm"
                            amount={item.precioUnitario}
                          />
                        </td>
                        <td className="py-2 text-right">
                          <PriceDisplay size="sm" amount={item.subtotal} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="Sin ítems para facturar" />
              )}
            </div>
            <div className="mt-4 space-y-1 px-4 sm:px-6">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <PriceDisplay amount={preCuenta.subtotal} />
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Impuesto {porcentajeImpuesto}%
                </span>
                <PriceDisplay amount={preCuenta.impuesto} />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
                <span className="text-lg font-bold">TOTAL</span>
                <PriceDisplay
                  size="xl"
                  variant="accent"
                  amount={preCuenta.total}
                />
              </div>
            </div>
            <form
              className="mt-4 border-t border-border-subtle px-4 pt-4 sm:px-6"
              onSubmit={(event) => void handleEmitir(event)}
              noValidate
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <h2 className="mb-2 text-[10px] uppercase tracking-widest text-text-secondary">
                    Método de pago
                  </h2>
                  <div
                    role="radiogroup"
                    aria-label="Método de pago"
                    aria-describedby={
                      formErrors.metodoPago ? 'metodo-pago-error' : undefined
                    }
                    className="flex flex-wrap gap-2"
                  >
                    {paymentMethods.map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        role="radio"
                        aria-checked={metodoPago === method.value}
                        className={clsx(
                          'min-h-[44px] rounded-md px-4 text-sm transition-colors',
                          metodoPago === method.value
                            ? 'bg-accent text-white'
                            : 'border border-border-default text-text-secondary hover:bg-bg-elevated'
                        )}
                        onClick={() => {
                          setMetodoPago(method.value)
                          setFormErrors((current) => ({
                            ...current,
                            metodoPago: undefined,
                          }))
                        }}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                  {formErrors.metodoPago && (
                    <p
                      id="metodo-pago-error"
                      role="alert"
                      className="mt-1 text-[11px] text-state-error"
                    >
                      {formErrors.metodoPago}
                    </p>
                  )}
                  {metodoPago === 'EFECTIVO' && (
                    <div className="mt-3 space-y-2">
                      <Input
                        label="Monto Recibido"
                        inputMode="decimal"
                        value={montoRecibido}
                        onChange={(event) =>
                          setMontoRecibido(event.target.value)
                        }
                        error={formErrors.montoRecibido}
                      />
                      {cambio !== null && Number.isFinite(cambio) && (
                        <p
                          className={clsx(
                            'text-sm',
                            cambio < 0
                              ? 'text-state-error'
                              : 'text-text-primary'
                          )}
                        >
                          Cambio: <PriceDisplay size="sm" amount={cambio} />
                        </p>
                      )}
                    </div>
                  )}
                </section>
                <section className="space-y-2">
                  <h2 className="mb-2 text-[10px] uppercase tracking-widest text-text-secondary">
                    Datos fiscales
                  </h2>
                  <Input
                    label="RTN del cliente (opcional)"
                    value={rtn}
                    onChange={(event) => setRtn(event.target.value)}
                    error={formErrors.rtn}
                    inputMode="numeric"
                  />
                  <Input
                    label="Número CAI (opcional)"
                    value={cai}
                    onChange={(event) => setCai(event.target.value)}
                    error={formErrors.cai}
                  />
                </section>
              </div>
              <div className="mt-6 pb-6">
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  disabled={!metodoPago || emitiendo}
                  loading={emitiendo}
                >
                  Emitir Factura
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

interface PendingMesaProps {
  mesa: Mesa
  active: boolean
  amount?: number
  onClick: () => void
}
function PendingMesa({
  mesa,
  active,
  amount,
  onClick,
}: PendingMesaProps): React.JSX.Element {
  const time = useTimer(mesa.abiertaEn)
  return (
    <button
      type="button"
      aria-pressed={active}
      className={clsx(
        'block min-h-[44px] w-full border-b border-border-subtle p-4 text-left transition-colors hover:bg-bg-elevated',
        active && 'border-l-2 border-accent bg-bg-elevated'
      )}
      onClick={onClick}
    >
      <span className="flex justify-between gap-2">
        <span className="text-sm font-semibold">Mesa {mesa.numero}</span>
        {amount !== undefined && <PriceDisplay size="sm" amount={amount} />}
      </span>
      <span className="mt-1 block text-xs text-text-secondary">
        {mesa.meseroActual?.nombre ?? 'Sin asignar'}
      </span>
      <span className="mt-1 flex items-center gap-1 text-xs text-state-warning">
        <Clock size={12} />
        {time}
      </span>
    </button>
  )
}

function FacturacionSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="max-h-56 w-full shrink-0 overflow-hidden border-b border-border-subtle bg-bg-surface p-4 lg:max-h-none lg:w-[300px] lg:border-b-0 lg:border-r">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="mb-3 h-20 animate-pulse rounded-lg bg-bg-elevated"
          />
        ))}
      </aside>
      <PreCuentaSkeleton />
    </div>
  )
}

function PreCuentaSkeleton(): React.JSX.Element {
  return (
    <div className="flex-1 p-6">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-bg-surface" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded bg-bg-surface"
          />
        ))}
      </div>
    </div>
  )
}
