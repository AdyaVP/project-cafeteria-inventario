import { z } from 'zod'
import { apiFetch } from './client'
import { UsuarioSchema } from './schemas'
import type {
  ActualizarRolesUsuarioDto,
  CrearUsuarioDto,
  RequestOptions,
  Usuario,
} from '../types'

export const usuariosApi = {
  getAll: (options: RequestOptions = {}): Promise<Usuario[]> =>
    apiFetch('/usuarios', {
      ...options,
      schema: z.array(UsuarioSchema),
    }),
  crear: (dto: CrearUsuarioDto): Promise<Usuario> =>
    apiFetch('/auth/registro', {
      method: 'POST',
      body: JSON.stringify(dto),
      schema: UsuarioSchema,
    }),
  actualizarRoles: (
    id: string,
    dto: ActualizarRolesUsuarioDto
  ): Promise<Usuario> =>
    apiFetch(`/usuarios/${id}/roles`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      schema: UsuarioSchema,
    }),
  desactivar: (id: string): Promise<void> =>
    apiFetch(`/usuarios/${id}/desactivar`, { method: 'PATCH' }),
}
