'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const selectionRequestRef = useRef<AbortController | null>(null)
  const selectionSequenceRef = useRef(0)
  const listSequenceRef = useRef(0)
  const listControllerRef = useRef<AbortController | null>(null)
  const hasLoadedListRef = useRef(false)
  const load = useCallback(
    async (signal?: AbortSignal, silent = false): Promise<void> => {
      listControllerRef.current?.abort()
      const controller = signal ? null : new AbortController()
      listControllerRef.current = controller
      const requestSignal = signal ?? controller?.signal
      const sequence = listSequenceRef.current + 1
      listSequenceRef.current = sequence
      try {
        if (!silent) setLoading(true)
        if (!silent) setError(null)
        const mesas = await mesasApi.getMesas({ signal: requestSignal })
        if (listSequenceRef.current === sequence) {
          setMesasPendientes(
            mesas.filter((mesa) => mesa.estado === 'CUENTA_PEDIDA')
          )
          hasLoadedListRef.current = true
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (
          (!silent || !hasLoadedListRef.current) &&
          listSequenceRef.current === sequence
        ) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : 'Error inesperado al cargar facturación'
          )
        }
      } finally {
        if (!requestSignal?.aborted && listSequenceRef.current === sequence) {
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
      listControllerRef.current?.abort()
      selectionRequestRef.current?.abort()
    }
  }, [load])
  useEffect(() => {
    if (!socket) return
    const sync = (): void => {
      // Mantener estable la pre-cuenta/formulario mientras llega un evento WS.
      void load(undefined, true)
    }
    socket.on(WS_EVENTS.connect, sync)
    socket.on(WS_EVENTS.mesaActualizada, sync)
    return () => {
      socket.off(WS_EVENTS.connect, sync)
      socket.off(WS_EVENTS.mesaActualizada, sync)
    }
  }, [load, socket])
  useEffect(() => {
    if (
      !mesaSeleccionada ||
      mesasPendientes.some((mesa) => mesa.id === mesaSeleccionada.id)
    )
      return
    selectionSequenceRef.current += 1
    selectionRequestRef.current?.abort()
    setMesaSeleccionada(null)
    setPreCuenta(null)
  }, [mesaSeleccionada, mesasPendientes])
  const seleccionarMesa = useCallback(async (mesa: Mesa): Promise<void> => {
    selectionRequestRef.current?.abort()
    selectionRequestRef.current = null
    const sequence = selectionSequenceRef.current + 1
    selectionSequenceRef.current = sequence
    setMesaSeleccionada(mesa)
    setPreCuenta(null)
    if (mesa.estado !== 'CUENTA_PEDIDA') {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    selectionRequestRef.current = controller
    try {
      setLoading(true)
      setError(null)
      const cuenta = await cajaApi.getPreCuenta(mesa.id, {
        signal: controller.signal,
      })
      if (
        !controller.signal.aborted &&
        selectionSequenceRef.current === sequence
      ) {
        setPreCuenta(cuenta)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (selectionSequenceRef.current !== sequence) return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar la pre-cuenta'
      )
      throw err
    } finally {
      if (
        !controller.signal.aborted &&
        selectionSequenceRef.current === sequence
      ) {
        selectionRequestRef.current = null
        setLoading(false)
      }
    }
  }, [])
  const emitirFactura = useCallback(
    async (dto: EmitirFacturaDto): Promise<Factura> => {
      try {
        selectionSequenceRef.current += 1
        selectionRequestRef.current?.abort()
        selectionRequestRef.current = null
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
