import { z } from 'zod'
import { apiFetch } from './client'
import { ProductoSchema } from './schemas'
import type {
  ActualizarProductoDto,
  CrearProductoDto,
  Producto,
  RequestOptions,
} from '../types'

export const productosApi = {
  getAll: (options: RequestOptions = {}): Promise<Producto[]> =>
    apiFetch('/productos', {
      ...options,
      schema: z.array(ProductoSchema),
    }),
  getDisponibles: (options: RequestOptions = {}): Promise<Producto[]> =>
    apiFetch('/productos/disponibles', {
      ...options,
      schema: z.array(ProductoSchema),
    }),
  crear: (dto: CrearProductoDto): Promise<Producto> =>
    apiFetch('/productos', {
      method: 'POST',
      body: JSON.stringify(dto),
      schema: ProductoSchema,
    }),
  actualizar: (id: string, dto: ActualizarProductoDto): Promise<Producto> =>
    apiFetch(`/productos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      schema: ProductoSchema,
    }),
  toggleDisponibilidad: (id: string): Promise<Producto> =>
    apiFetch(`/productos/${id}/disponibilidad`, {
      method: 'PATCH',
      schema: ProductoSchema,
    }),
}
