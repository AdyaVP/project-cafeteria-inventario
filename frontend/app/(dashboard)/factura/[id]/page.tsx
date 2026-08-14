'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataError } from '@/components/ui/DataError'
import { FacturaSkeleton } from '@/components/ui/FacturaSkeleton'
import { cajaApi } from '@/lib/api/caja'
import { ApiClientError } from '@/lib/api/client'
import { NEGOCIO, WHATSAPP_WEB_URL } from '@/lib/constants'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import type { FacturaDetalle } from '@/lib/types'

const formatoMoneda = new Intl.NumberFormat('es-HN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatearNumeroFactura(id: string): string {
  const segmentoHexadecimal = id.slice(-8)
  const valor = Number.parseInt(segmentoHexadecimal, 16)
  const correlativo = Number.isFinite(valor) ? (valor % 99_999_999) + 1 : 1

  return `${NEGOCIO.prefijoFactura}${correlativo.toString().padStart(8, '0')}`
}

function obtenerMesaLabel(mesa: FacturaDetalle['mesa']): string {
  return typeof mesa === 'string' ? `Mesa ${mesa}` : `Mesa ${mesa.numero}`
}

export default function FacturaPage(): React.JSX.Element | null {
  const { autorizado, loading: authLoading } = useRolGuard(['ADMIN', 'CAJERO'])
  const [factura, setFactura] = useState<FacturaDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const params = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    document.body.classList.add('invoice-print-view')
    return () => document.body.classList.remove('invoice-print-view')
  }, [])

  useEffect(() => {
    if (!autorizado) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    void cajaApi
      .getFactura(params.id, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setFactura(data)
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof Error &&
          requestError.name === 'AbortError'
        ) {
          return
        }
        if (controller.signal.aborted) return
        setError(
          requestError instanceof ApiClientError
            ? requestError.message
            : 'Error inesperado al cargar la factura'
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [autorizado, params.id])

  const compartirWhatsApp = (): void => {
    if (!factura) return

    const mesaLabel =
      typeof factura.mesa === 'string'
        ? `Mesa ${factura.mesa}`
        : `Mesa ${factura.mesa.numero}`

    const items = factura.itemsSnapshot
      .map((i) => `  - ${i.cantidad}x ${i.nombre}: L. ${i.subtotal.toFixed(2)}`)
      .join('\n')

    const fecha = new Date(factura.fechaEmision).toLocaleDateString('es-HN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const texto = [
      `*${NEGOCIO.nombre}*`,
      `RTN: ${NEGOCIO.rtn}`,
      ``,
      `*FACTURA DE CONSUMO*`,
      `Fecha: ${fecha}`,
      mesaLabel,
      ``,
      `*DETALLE:*`,
      items,
      ``,
      `Subtotal: L. ${factura.subtotal.toFixed(2)}`,
      `ISV: L. ${factura.impuesto.toFixed(2)}`,
      `*TOTAL: L. ${factura.total.toFixed(2)}*`,
      ``,
      `Metodo de pago: ${factura.metodoPago}`,
      `CAI: ${factura.cai ?? NEGOCIO.cai}`,
      ``,
      `_La factura es beneficio de todos, exigela_`,
    ].join('\n')

    window.open(
      `${WHATSAPP_WEB_URL}send?text=${encodeURIComponent(texto)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  if (authLoading || !autorizado) return null
  if (loading) return <FacturaSkeleton />
  if (error || !factura) {
    return (
      <DataError
        message={error ?? 'No se encontró la factura solicitada'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const porcentajeISV =
    factura.subtotal > 0
      ? ((factura.impuesto / factura.subtotal) * 100).toFixed(0)
      : '15'

  return (
    <div className="invoice-print-page">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          icon={<ArrowLeft size={18} />}
          onClick={() => router.back()}
        >
          Volver
        </Button>
        <h1 className="text-lg font-bold">Factura emitida</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Printer size={18} />}
            onClick={() => window.print()}
          >
            Imprimir
          </Button>
          <Button
            variant="primary"
            icon={<MessageCircle size={16} />}
            onClick={compartirWhatsApp}
          >
            Compartir por WhatsApp
          </Button>
        </div>
      </div>

      <article className="invoice-document relative mx-auto max-w-[800px] rounded-lg bg-white p-8 text-black shadow-lg print:p-4 print:shadow-none">
        {factura.estado === 'ANULADA' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
            <span className="select-none text-6xl font-bold text-red-500/30 rotate-[-30deg]">
              ANULADA
            </span>
          </div>
        )}

        <header className="mb-4 border-b-2 border-black pb-4 text-center">
          <p className="text-xl font-bold uppercase">{NEGOCIO.nombre}</p>
          <p className="text-sm">RTN: {NEGOCIO.rtn}</p>
          <p className="text-sm">{NEGOCIO.direccion}</p>
          <p className="text-sm">{NEGOCIO.telefono}</p>
          <div className="mt-3 inline-block border border-black p-2">
            <p className="text-xs font-bold">FACTURA</p>
            <p className="font-mono text-lg font-bold">
              {formatearNumeroFactura(factura.id)}
            </p>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p>Fecha de emisión:</p>
            <p className="font-semibold">
              {new Date(factura.fechaEmision).toLocaleDateString('es-HN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p>CAI:</p>
            <p className="break-all font-mono text-xs">
              {factura.cai ?? NEGOCIO.cai}
            </p>
          </div>
          <div>
            <p>RTN Cliente:</p>
            <p className="font-semibold">{factura.rtn ?? 'Consumidor Final'}</p>
          </div>
          <div>
            <p>Nombre / Razón Social:</p>
            <p className="font-semibold">
              {factura.razonSocial ?? 'Consumidor Final'}
            </p>
          </div>
          <div>
            <p>Método de pago:</p>
            <p className="font-semibold">{factura.metodoPago}</p>
          </div>
          <div>
            <p>Mesa:</p>
            <p className="font-semibold">{obtenerMesaLabel(factura.mesa)}</p>
          </div>
        </section>

        <div className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead className="border-y-2 border-black">
              <tr>
                <th scope="col" className="py-2 text-left">
                  DESCRIPCIÓN
                </th>
                <th scope="col" className="w-16 py-2 text-center">
                  CANT
                </th>
                <th scope="col" className="w-24 py-2 text-right">
                  PRECIO UNIT
                </th>
                <th scope="col" className="w-24 py-2 text-right">
                  SUBTOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {factura.itemsSnapshot.map((item, index) => (
                <tr
                  key={`${item.nombre}-${index}`}
                  className="border-b border-gray-300"
                >
                  <td className="py-1">{item.nombre}</td>
                  <td className="py-1 text-center">{item.cantidad}</td>
                  <td className="py-1 text-right font-mono">
                    L. {formatoMoneda.format(item.precioUnitario)}
                  </td>
                  <td className="py-1 text-right font-mono">
                    L. {formatoMoneda.format(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mb-6 flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-8">
            <span>Subtotal:</span>
            <span className="w-28 text-right font-mono">
              L. {formatoMoneda.format(factura.subtotal)}
            </span>
          </div>
          <div className="flex gap-8">
            <span>ISV {porcentajeISV}%:</span>
            <span className="w-28 text-right font-mono">
              L. {formatoMoneda.format(factura.impuesto)}
            </span>
          </div>
          <div className="flex gap-8 border-t-2 border-black pt-1 text-base font-bold">
            <span>TOTAL A PAGAR:</span>
            <span className="w-28 text-right font-mono">
              L. {formatoMoneda.format(factura.total)}
            </span>
          </div>
        </section>

        <footer className="space-y-1 border-t-2 border-black pt-4 text-center text-xs">
          <p className="font-bold uppercase">
            La factura es beneficio de todos, exígela
          </p>
          <p>CAI: {factura.cai ?? NEGOCIO.cai}</p>
          <p>
            Rango autorizado: {NEGOCIO.rangoDesde} al {NEGOCIO.rangoHasta}
          </p>
          <p>Fecha límite de emisión del CAI: {NEGOCIO.fechaLimiteCai}</p>
        </footer>
      </article>
    </div>
  )
}
