'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const loadSequenceRef = useRef(0)
  const loadControllerRef = useRef<AbortController | null>(null)
  const hasLoadedRef = useRef(false)
  const load = useCallback(
    async (signal?: AbortSignal, silent = false): Promise<void> => {
      loadControllerRef.current?.abort()
      const controller = signal ? null : new AbortController()
      loadControllerRef.current = controller
      const requestSignal = signal ?? controller?.signal
      const sequence = loadSequenceRef.current + 1
      loadSequenceRef.current = sequence
      try {
        if (!silent) setLoading(true)
        if (!silent) setError(null)
        const next = await cocinaApi.getCola({ signal: requestSignal })
        if (loadSequenceRef.current === sequence) {
          setOrdenes(next)
          hasLoadedRef.current = true
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (
          (!silent || !hasLoadedRef.current) &&
          loadSequenceRef.current === sequence
        ) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : 'Error inesperado al cargar la cola'
          )
        }
      } finally {
        if (!requestSignal?.aborted && loadSequenceRef.current === sequence) {
          setLoading(false)
        }
      }
    },
    []
  )
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => {
      controller.abort()
      loadControllerRef.current?.abort()
    }
  }, [load])
  useEffect(() => {
    if (!socket) return
    const sync = (): void => {
      // Los eventos en tiempo real actualizan la cola sin desmontar el kanban.
      void load(undefined, true)
    }
    socket.on(WS_EVENTS.connect, sync)
    socket.on(WS_EVENTS.nuevaOrden, sync)
    socket.on(WS_EVENTS.ordenActualizada, sync)
    return () => {
      socket.off(WS_EVENTS.connect, sync)
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
        try {
          const authoritative = await cocinaApi.getCola()
          setOrdenes(authoritative)
        } catch {
          setOrdenes(previous)
        }
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
