'use client'

import { useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { useToast } from '@/lib/context/ToastContext'
import { useMesas } from '@/lib/hooks/useMesas'
import { useReporteDiario } from '@/lib/hooks/useReporteDiario'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import type { MetodoPago, ReporteDiario } from '@/lib/types'

const METODOS_PAGO: Array<{ value: MetodoPago; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
]

export default function DashboardPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN'])

  if (loading || !autorizado) return null

  return <DashboardContent />
}

function DashboardContent(): React.JSX.Element {
  const hoy = new Date().toISOString().split('T')[0]
  const fechaActual = new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'full',
  }).format(new Date())
  const { socket } = useWebSocket()
  const {
    reporte,
    loading: reporteLoading,
    error: reporteError,
    refetch: refetchReporte,
  } = useReporteDiario(hoy)
  const {
    mesas,
    loading: mesasLoading,
    error: mesasError,
    refetch: refetchMesas,
  } = useMesas(socket)
  const { toast } = useToast()
  const loading = reporteLoading || mesasLoading
  const error = reporteError ?? mesasError
  const mesasOcupadas = mesas.filter((mesa) => mesa.estado === 'OCUPADA').length

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  const retry = (): void => {
    void refetchReporte()
    void refetchMesas()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Dashboard Operativo</h1>
        <p className="mt-1 capitalize text-text-secondary">{fechaActual}</p>
      </header>

      {loading ? (
        <DashboardSkeleton />
      ) : error && !reporte ? (
        <DataError message={error} onRetry={retry} />
      ) : reporte ? (
        <>
          {error && <DataError message={error} onRetry={retry} />}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="TOTAL SALES">
              <PriceDisplay
                size="xl"
                variant="accent"
                amount={reporte.totalCobrado ?? 0}
              />
            </KpiCard>
            <KpiCard label="TOTAL ORDERS">
              <span className="text-3xl font-bold">
                {reporte.mesasAtendidas ?? 0}
              </span>
            </KpiCard>
            <KpiCard label="AVG TICKET">
              <PriceDisplay size="xl" amount={reporte.ticketPromedio ?? 0} />
            </KpiCard>
            <KpiCard label="OCCUPIED TABLES">
              <span className="text-3xl font-bold">
                {mesasOcupadas} / {mesas.length}
              </span>
            </KpiCard>
          </div>

          <MetodosPagoTable reporte={reporte} />
        </>
      ) : (
        <EmptyState title="Sin datos para hoy" />
      )}
    </div>
  )
}

interface MetodosPagoTableProps {
  reporte: ReporteDiario
}

function MetodosPagoTable({
  reporte,
}: MetodosPagoTableProps): React.JSX.Element {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold">Métodos de pago</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] uppercase text-text-secondary">
              <th className="pb-2 text-left font-medium">Método</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {METODOS_PAGO.map((metodo) => (
              <tr
                key={metodo.value}
                className="border-b border-border-subtle/50 last:border-0"
              >
                <td className="py-3 text-sm">{metodo.label}</td>
                <td className="py-3 text-right">
                  <PriceDisplay
                    size="sm"
                    amount={reporte.desglosePorMetodoPago[metodo.value] ?? 0}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg bg-bg-surface"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-lg bg-bg-surface" />
    </div>
  )
}

interface KpiCardProps {
  label: string
  children: React.ReactNode
}

function KpiCard({ label, children }: KpiCardProps): React.JSX.Element {
  return (
    <Card>
      <p className="mb-2 text-[10px] uppercase tracking-widest text-text-secondary">
        {label}
      </p>
      {children}
    </Card>
  )
}
