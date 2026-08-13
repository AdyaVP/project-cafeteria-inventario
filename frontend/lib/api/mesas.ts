import { z } from 'zod'
import { apiFetch } from './client'
import { MesaSchema } from './schemas'
import type { Mesa, RequestOptions } from '../types'

export const mesasApi = {
  getMesas: (options: RequestOptions = {}): Promise<Mesa[]> =>
    apiFetch('/mesas', { ...options, schema: z.array(MesaSchema) }),
  getMesa: (id: string, options: RequestOptions = {}): Promise<Mesa> =>
    apiFetch(`/mesas/${id}`, { ...options, schema: MesaSchema }),
  abrirMesa: (id: string): Promise<Mesa> =>
    apiFetch(`/mesas/${id}/abrir`, { method: 'PATCH', schema: MesaSchema }),
  solicitarCuenta: (id: string): Promise<Mesa> =>
    apiFetch(`/mesas/${id}/solicitar-cuenta`, {
      method: 'PATCH',
      schema: MesaSchema,
    }),
}
