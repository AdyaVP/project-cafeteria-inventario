'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiClientError } from '../api/client'
import { usuariosApi } from '../api/usuarios'
import type {
  ActualizarRolesUsuarioDto,
  CrearUsuarioDto,
  Usuario,
} from '../types'

interface UseUsuariosReturn {
  usuarios: Usuario[]
  loading: boolean
  saving: boolean
  error: string | null
  refetch: () => Promise<void>
  crear: (dto: CrearUsuarioDto) => Promise<Usuario>
  actualizarRoles: (
    id: string,
    dto: ActualizarRolesUsuarioDto
  ) => Promise<Usuario>
  desactivar: (id: string) => Promise<void>
}

function mensajeError(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

function ordenarUsuarios(usuarios: Usuario[]): Usuario[] {
  return [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function useUsuarios(): UseUsuariosReturn {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setUsuarios(ordenarUsuarios(await usuariosApi.getAll({ signal })))
    } catch (loadError: unknown) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return
      setError(mensajeError(loadError, 'No fue posible cargar los usuarios'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const crear = async (dto: CrearUsuarioDto): Promise<Usuario> => {
    setSaving(true)
    setError(null)
    try {
      const nuevo = await usuariosApi.crear(dto)
      setUsuarios((current) => ordenarUsuarios([...current, nuevo]))
      return nuevo
    } catch (mutationError: unknown) {
      const message = mensajeError(
        mutationError,
        'No fue posible crear el usuario'
      )
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  const actualizarRoles = async (
    id: string,
    dto: ActualizarRolesUsuarioDto
  ): Promise<Usuario> => {
    setSaving(true)
    setError(null)
    try {
      const actualizado = await usuariosApi.actualizarRoles(id, dto)
      setUsuarios((current) =>
        current.map((usuario) =>
          usuario.id === actualizado.id ? actualizado : usuario
        )
      )
      return actualizado
    } catch (mutationError: unknown) {
      const message = mensajeError(
        mutationError,
        'No fue posible actualizar los roles'
      )
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  const desactivar = async (id: string): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await usuariosApi.desactivar(id)
      setUsuarios((current) => current.filter((usuario) => usuario.id !== id))
    } catch (mutationError: unknown) {
      const message = mensajeError(
        mutationError,
        'No fue posible desactivar el usuario'
      )
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  return {
    usuarios,
    loading,
    saving,
    error,
    refetch: () => load(),
    crear,
    actualizarRoles,
    desactivar,
  }
}
