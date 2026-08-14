import { z } from 'zod'
import { apiFetch } from './client'
import { InventarioItemSchema } from './schemas'
import type {
  AjustarStockDto,
  CrearInventarioItemDto,
  InventarioItem,
  RequestOptions,
} from '../types'

export const inventarioApi = {
  getAll: (options: RequestOptions = {}): Promise<InventarioItem[]> =>
    apiFetch('/inventario', {
      ...options,
      schema: z.array(InventarioItemSchema),
    }),
  getAlertas: (options: RequestOptions = {}): Promise<InventarioItem[]> =>
    apiFetch('/inventario/alertas', {
      ...options,
      schema: z.array(InventarioItemSchema),
    }),
  crear: (dto: CrearInventarioItemDto): Promise<InventarioItem> =>
    apiFetch('/inventario', {
      method: 'POST',
      body: JSON.stringify(dto),
      schema: InventarioItemSchema,
    }),
  ajustarStock: (id: string, dto: AjustarStockDto): Promise<InventarioItem> =>
    apiFetch(`/inventario/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      schema: InventarioItemSchema,
    }),
}
