import { z } from 'zod'
import { apiFetch } from './client'
import { OrdenSchema } from './schemas'
import type { Orden, RequestOptions } from '../types'

export const cocinaApi = {
  getCola: (options: RequestOptions = {}): Promise<Orden[]> =>
    apiFetch('/cocina/cola', { ...options, schema: z.array(OrdenSchema) }),
  marcarEnPreparacion: (ordenId: string): Promise<Orden> =>
    apiFetch(`/cocina/${ordenId}/preparacion`, {
      method: 'PATCH',
      schema: OrdenSchema,
    }),
  marcarLista: (ordenId: string): Promise<Orden> =>
    apiFetch(`/cocina/${ordenId}/lista`, {
      method: 'PATCH',
      schema: OrdenSchema,
    }),
}
