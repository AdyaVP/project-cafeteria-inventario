import { z } from 'zod'
import { apiFetch } from './client'
import { RecetaSchema } from './schemas'
import type {
  ActualizarRecetaDto,
  CrearRecetaDto,
  Receta,
  RequestOptions,
} from '../types'

export const recetasApi = {
  getAll: (options: RequestOptions = {}): Promise<Receta[]> =>
    apiFetch('/recetas', {
      ...options,
      schema: z.array(RecetaSchema),
    }),
  crear: (dto: CrearRecetaDto): Promise<Receta> =>
    apiFetch('/recetas', {
      method: 'POST',
      body: JSON.stringify(dto),
      schema: RecetaSchema,
    }),
  actualizar: (productoId: string, dto: ActualizarRecetaDto): Promise<Receta> =>
    apiFetch(`/recetas/${productoId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      schema: RecetaSchema,
    }),
}
