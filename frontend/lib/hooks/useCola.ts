'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { cocinaApi } from '../api/cocina'
import { ApiClientError } from '../api/client'
import { WS_EVENTS } from '../constants'
import type { EstadoOrden, Orden } from '../types'
interface UseColaReturn {
  pendientes: Orden[]
  enPreparacion: Orden[]
  listas: Orden[]
  loading: boolean
  error: string | null
  marcarEnPreparacion: (id: string) => Promise<void>
  marcarLista: (id: string) => Promise<void>
  refetch: () => Promise<void>
}
export function useCola(socket?: Socket | null): UseColaReturn {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setOrdenes(await cocinaApi.getCola({ signal }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar la cola'
      )
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])
  useEffect(() => {
    if (!socket) return
    const sync = (): void => {
      void load()
    }
    socket.on(WS_EVENTS.nuevaOrden, sync)
    socket.on(WS_EVENTS.ordenActualizada, sync)
    return () => {
      socket.off(WS_EVENTS.nuevaOrden, sync)
      socket.off(WS_EVENTS.ordenActualizada, sync)
    }
  }, [load, socket])
  const mutate = useCallback(
    async (
      id: string,
      estadoGeneral: EstadoOrden,
      request: (ordenId: string) => Promise<Orden>
    ): Promise<void> => {
      let previous: Orden[] = []
      setOrdenes((current) => {
        previous = current
        return current.map((orden) =>
          orden.id === id ? { ...orden, estadoGeneral } : orden
        )
      })
      try {
        const updated = await request(id)
        setOrdenes((current) =>
          current.map((orden) => (orden.id === updated.id ? updated : orden))
        )
      } catch (err: unknown) {
        setOrdenes(previous)
        throw err
      }
    },
    []
  )
  const pendientes = useMemo(
    () => ordenes.filter((item) => item.estadoGeneral === 'PENDIENTE'),
    [ordenes]
  )
  const enPreparacion = useMemo(
    () => ordenes.filter((item) => item.estadoGeneral === 'EN_PREPARACION'),
    [ordenes]
  )
  const listas = useMemo(
    () => ordenes.filter((item) => item.estadoGeneral === 'LISTA'),
    [ordenes]
  )
  return {
    pendientes,
    enPreparacion,
    listas,
    loading,
    error,
    marcarEnPreparacion: (id) =>
      mutate(id, 'EN_PREPARACION', cocinaApi.marcarEnPreparacion),
    marcarLista: (id) => mutate(id, 'LISTA', cocinaApi.marcarLista),
    refetch: () => load(),
  }
}
