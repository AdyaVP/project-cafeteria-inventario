import { apiFetch } from './client'
import { FacturaSchema, PreCuentaSchema, ReporteDiarioSchema } from './schemas'
import type {
  EmitirFacturaDto,
  Factura,
  PreCuentaResponse,
  ReporteDiario,
  RequestOptions,
} from '../types'

export const cajaApi = {
  getPreCuenta: (
    mesaId: string,
    options: RequestOptions = {}
  ): Promise<PreCuentaResponse> =>
    apiFetch(`/caja/pre-cuenta/${mesaId}`, {
      ...options,
      schema: PreCuentaSchema,
    }),
  emitirFactura: (dto: EmitirFacturaDto): Promise<Factura> =>
    apiFetch('/caja/factura', {
      method: 'POST',
      body: JSON.stringify(dto),
      schema: FacturaSchema,
    }),
  getReporteDiario: (
    fecha: string,
    options: RequestOptions = {}
  ): Promise<ReporteDiario> =>
    apiFetch(`/caja/reportes/diario?fecha=${encodeURIComponent(fecha)}`, {
      ...options,
      schema: ReporteDiarioSchema,
    }),
}
