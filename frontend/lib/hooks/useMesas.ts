'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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
        const next = await mesasApi.getMesas({ signal: requestSignal })
        if (loadSequenceRef.current === sequence) {
          setMesas(next)
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
              : 'Error inesperado al cargar las mesas'
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
    const update = (mesa: Mesa): void => {
      void mesa
      void load(undefined, true)
    }
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
        .catch(() => load(undefined, true))
    }
    const syncAfterReconnect = (): void => {
      void load(undefined, true)
    }
    socket.on(WS_EVENTS.connect, syncAfterReconnect)
    socket.on(WS_EVENTS.mesaActualizada, handleMesaActualizada)
    return () => {
      socket.off(WS_EVENTS.connect, syncAfterReconnect)
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
        // Una carrera puede haber sido resuelta por otro cliente mientras
        // llega este error. Releer evita pisar un evento WS más reciente.
        try {
          const authoritative = await mesasApi.getMesas()
          setMesas(authoritative)
        } catch {
          setMesas(previous)
        }
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
