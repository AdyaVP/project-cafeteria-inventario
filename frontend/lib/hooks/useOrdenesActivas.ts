'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { ApiClientError } from '../api/client'
import { ordenesApi } from '../api/ordenes'
import { WS_EVENTS } from '../constants'
import type { Orden } from '../types'

interface UseOrdenesActivasReturn {
  ordenes: Orden[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useOrdenesActivas(
  socket?: Socket | null
): UseOrdenesActivasReturn {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setOrdenes(await ordenesApi.getActivas({ signal }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar las órdenes'
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

  return { ordenes, loading, error, refetch: () => load() }
}
