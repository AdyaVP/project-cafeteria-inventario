'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { ApiClientError } from '../api/client'
import { mesasApi } from '../api/mesas'
import { WS_EVENTS } from '../constants'
import type { Mesa } from '../types'
interface UseMesasReturn {
  mesas: Mesa[]
  loading: boolean
  error: string | null
  abrirMesa: (id: string) => Promise<void>
  solicitarCuenta: (id: string) => Promise<void>
  refetch: () => Promise<void>
}
interface MesaActualizadaEvent {
  mesaId: string
}
export function useMesas(socket?: Socket | null): UseMesasReturn {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setMesas(await mesasApi.getMesas({ signal }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar las mesas'
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
    const update = (mesa: Mesa): void =>
      setMesas((current) =>
        current.map((item) => (item.id === mesa.id ? mesa : item))
      )
    const handleMesaActualizada = (
      payload: Mesa | MesaActualizadaEvent
    ): void => {
      if ('id' in payload) {
        update(payload)
        return
      }
      void mesasApi
        .getMesa(payload.mesaId)
        .then(update)
        .catch(() => load())
    }
    socket.on(WS_EVENTS.mesaActualizada, handleMesaActualizada)
    return () => {
      socket.off(WS_EVENTS.mesaActualizada, handleMesaActualizada)
    }
  }, [load, socket])
  const mutate = useCallback(
    async (
      id: string,
      estado: Mesa['estado'],
      request: (mesaId: string) => Promise<Mesa>
    ): Promise<void> => {
      let previous: Mesa[] = []
      setMesas((current) => {
        previous = current
        return current.map((mesa) =>
          mesa.id === id ? { ...mesa, estado } : mesa
        )
      })
      try {
        const updated = await request(id)
        setMesas((current) =>
          current.map((mesa) => (mesa.id === updated.id ? updated : mesa))
        )
      } catch (err: unknown) {
        setMesas(previous)
        throw err
      }
    },
    []
  )
  return {
    mesas,
    loading,
    error,
    abrirMesa: (id) => mutate(id, 'OCUPADA', mesasApi.abrirMesa),
    solicitarCuenta: (id) =>
      mutate(id, 'CUENTA_PEDIDA', mesasApi.solicitarCuenta),
    refetch: () => load(),
  }
}
