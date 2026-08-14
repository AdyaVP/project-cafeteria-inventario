'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { useToast } from '@/lib/context/ToastContext'
import { getBusinessDateISO } from '@/lib/date'
import { useReporteDiario } from '@/lib/hooks/useReporteDiario'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import type { MetodoPago, ReporteDiario } from '@/lib/types'

const METODOS_PAGO: Array<{ value: MetodoPago; label: string }> = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
]

const ReporteFechaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha válida'),
})

export default function ReportesPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN'])

  if (loading || !autorizado) return null

  return <ReportesContent />
}

function ReportesContent(): React.JSX.Element {
  const hoy = getBusinessDateISO()
  const [fechaInput, setFechaInput] = useState(hoy)
  const [fechaConsulta, setFechaConsulta] = useState(hoy)
  const [fechaError, setFechaError] = useState<string>()
  const { reporte, loading, error, refetch } = useReporteDiario(fechaConsulta)
  const { toast } = useToast()

  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])

  const consultar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const result = ReporteFechaSchema.safeParse({ fecha: fechaInput })
    if (!result.success) {
      setFechaError(result.error.flatten().fieldErrors.fecha?.[0])
      return
    }
    if (result.data.fecha > hoy) {
      setFechaError('La fecha no puede estar en el futuro')
      return
    }
    setFechaError(undefined)
    if (fechaInput === fechaConsulta) {
      void refetch()
      return
    }
    setFechaConsulta(fechaInput)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Reportes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Historial de ventas por fecha
        </p>
      </header>

      <Card>
        <form className="flex flex-wrap items-end gap-3" onSubmit={consultar}>
          <div className="w-full sm:w-56">
            <Input
              name="fecha"
              label="Fecha"
              type="date"
              value={fechaInput}
              max={hoy}
              error={fechaError}
              onChange={(event) => setFechaInput(event.target.value)}
            />
          </div>
          <Button type="submit" loading={loading}>
            Consultar
          </Button>
        </form>
      </Card>

      {loading ? (
        <ReportesSkeleton />
      ) : error ? (
        <DataError message={error} onRetry={() => void refetch()} />
      ) : reporte ? (
        <ReporteTable reporte={reporte} />
      ) : (
        <EmptyState title="Sin datos para la fecha seleccionada" />
      )}
    </div>
  )
}

interface ReporteTableProps {
  reporte: ReporteDiario
}

function ReporteTable({ reporte }: ReporteTableProps): React.JSX.Element {
  return (
    <Card>
      <div className="mb-4">
        <h2 className="font-semibold">Resumen diario</h2>
        <p className="text-sm text-text-secondary">{reporte.fecha}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle text-[11px] uppercase text-text-secondary">
              <th className="pb-2 text-left font-medium">Concepto</th>
              <th className="pb-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            <ReporteRow label="Total cobrado">
              <PriceDisplay amount={reporte.totalCobrado ?? 0} />
            </ReporteRow>
            <ReporteRow label="Mesas atendidas">
              <span>{reporte.mesasAtendidas ?? 0}</span>
            </ReporteRow>
            <ReporteRow label="Ticket promedio">
              <PriceDisplay amount={reporte.ticketPromedio ?? 0} />
            </ReporteRow>
            {METODOS_PAGO.map((metodo) => (
              <ReporteRow key={metodo.value} label={`Pago: ${metodo.label}`}>
                <PriceDisplay
                  amount={reporte.desglosePorMetodoPago[metodo.value] ?? 0}
                />
              </ReporteRow>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

interface ReporteRowProps {
  label: string
  children: React.ReactNode
}

function ReporteRow({ label, children }: ReporteRowProps): React.JSX.Element {
  return (
    <tr className="border-b border-border-subtle/50 last:border-0">
      <td className="py-3 text-sm text-text-secondary">{label}</td>
      <td className="py-3 text-right font-medium">{children}</td>
    </tr>
  )
}

function ReportesSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-lg bg-bg-surface p-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded bg-bg-elevated"
        />
      ))}
    </div>
  )
}
