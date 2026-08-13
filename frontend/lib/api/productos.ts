import { z } from 'zod'
import { apiFetch } from './client'
import { ProductoSchema } from './schemas'
import type { Producto, RequestOptions } from '../types'

export const productosApi = {
  getDisponibles: (options: RequestOptions = {}): Promise<Producto[]> =>
    apiFetch('/productos/disponibles', {
      ...options,
      schema: z.array(ProductoSchema),
    }),
}
