'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { cajaApi } from '../api/caja'
import { ApiClientError } from '../api/client'
import { mesasApi } from '../api/mesas'
import { WS_EVENTS } from '../constants'
import type {
  EmitirFacturaDto,
  Factura,
  Mesa,
  PreCuentaResponse,
} from '../types'
interface UseFacturacionReturn {
  mesasPendientes: Mesa[]
  mesaSeleccionada: Mesa | null
  preCuenta: PreCuentaResponse | null
  loading: boolean
  error: string | null
  seleccionarMesa: (mesa: Mesa) => Promise<void>
  emitirFactura: (dto: EmitirFacturaDto) => Promise<Factura>
  refetch: () => Promise<void>
}
export function useFacturacion(socket?: Socket | null): UseFacturacionReturn {
  const [mesasPendientes, setMesasPendientes] = useState<Mesa[]>([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null)
  const [preCuenta, setPreCuenta] = useState<PreCuentaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      const mesas = await mesasApi.getMesas({ signal })
      setMesasPendientes(
        mesas.filter((mesa) => mesa.estado === 'CUENTA_PEDIDA')
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar facturación'
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
    socket.on(WS_EVENTS.mesaActualizada, sync)
    return () => {
      socket.off(WS_EVENTS.mesaActualizada, sync)
    }
  }, [load, socket])
  useEffect(() => {
    if (
      !mesaSeleccionada ||
      mesasPendientes.some((mesa) => mesa.id === mesaSeleccionada.id)
    )
      return
    setMesaSeleccionada(null)
    setPreCuenta(null)
  }, [mesaSeleccionada, mesasPendientes])
  const seleccionarMesa = useCallback(async (mesa: Mesa): Promise<void> => {
    setMesaSeleccionada(mesa)
    setPreCuenta(null)
    if (mesa.estado !== 'CUENTA_PEDIDA') return
    const controller = new AbortController()
    try {
      setLoading(true)
      setError(null)
      setPreCuenta(
        await cajaApi.getPreCuenta(mesa.id, { signal: controller.signal })
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar la pre-cuenta'
      )
      throw err
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])
  const emitirFactura = useCallback(
    async (dto: EmitirFacturaDto): Promise<Factura> => {
      try {
        setLoading(true)
        setError(null)
        const factura = await cajaApi.emitirFactura(dto)
        setMesasPendientes((current) =>
          current.filter((mesa) => mesa.id !== dto.mesaId)
        )
        setMesaSeleccionada(null)
        setPreCuenta(null)
        return factura
      } catch (err: unknown) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Error inesperado al emitir la factura'
        )
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )
  return {
    mesasPendientes,
    mesaSeleccionada,
    preCuenta,
    loading,
    error,
    seleccionarMesa,
    emitirFactura,
    refetch: () => load(),
  }
}
