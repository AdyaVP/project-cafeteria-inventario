import { z } from 'zod'
import { apiFetch } from './client'
import { OrdenSchema } from './schemas'
import type { CrearOrdenDto, Orden, RequestOptions } from '../types'

export const ordenesApi = {
  getActivas: (options: RequestOptions = {}): Promise<Orden[]> =>
    apiFetch('/ordenes', { ...options, schema: z.array(OrdenSchema) }),
  crearOrden: (dto: CrearOrdenDto): Promise<Orden[]> =>
    apiFetch('/ordenes', {
      method: 'POST',
      body: JSON.stringify(dto),
      schema: z.array(OrdenSchema),
    }),
  getOrdenesMesa: (
    mesaId: string,
    options: RequestOptions = {}
  ): Promise<Orden[]> =>
    apiFetch(`/ordenes/mesa/${mesaId}`, {
      ...options,
      schema: z.array(OrdenSchema),
    }),
  entregarOrden: (id: string): Promise<Orden> =>
    apiFetch(`/ordenes/${id}/entregar`, {
      method: 'PATCH',
      schema: OrdenSchema,
    }),
}
