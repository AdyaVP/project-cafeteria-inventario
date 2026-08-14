'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { mesasApi } from '../api/mesas'
import { ordenesApi } from '../api/ordenes'
import { WS_EVENTS } from '../constants'
import { useWebSocket } from '../hooks/useWebSocket'
import type { EstadoOrden, TipoOrden } from '../types'
import { useAuth } from './AuthContext'
import { usePreferences } from './PreferencesContext'
import { useToast } from './ToastContext'

export interface ReadyOrderAlert {
  ordenId: string
  mesaId: string
  mesaNumero: number
  tipo: TipoOrden
  timestamp: string
}

interface ReadyOrdersContextValue {
  alertas: ReadyOrderAlert[]
  total: number
  totalPorMesa: (mesaId: string) => number
  descartarOrden: (ordenId: string) => void
}

interface ReadyOrdersProviderProps {
  children: ReactNode
}

interface OrdenActualizadaEvent {
  ordenId: string
  mesaId: string
  mesaNumero: number
  meseroId: string
  tipo: TipoOrden
  nuevoEstado: Extract<EstadoOrden, 'EN_PREPARACION' | 'LISTA'>
  timestamp: string
}

const ReadyOrdersContext = createContext<ReadyOrdersContextValue | null>(null)

function isOrdenActualizadaEvent(
  payload: unknown
): payload is OrdenActualizadaEvent {
  if (typeof payload !== 'object' || payload === null) return false

  const event = payload as Record<string, unknown>
  return (
    typeof event.ordenId === 'string' &&
    typeof event.mesaId === 'string' &&
    typeof event.mesaNumero === 'number' &&
    typeof event.meseroId === 'string' &&
    (event.tipo === 'COCINA' || event.tipo === 'CAFETERIA') &&
    (event.nuevoEstado === 'EN_PREPARACION' || event.nuevoEstado === 'LISTA') &&
    typeof event.timestamp === 'string'
  )
}

export function ReadyOrdersProvider({
  children,
}: ReadyOrdersProviderProps): React.JSX.Element {
  const { usuario } = useAuth()
  const { playAlertSound } = usePreferences()
  const { toast } = useToast()
  const { socket } = useWebSocket()
  const [alertas, setAlertas] = useState<ReadyOrderAlert[]>([])
  const [alertOwnerId, setAlertOwnerId] = useState<string | null>(null)
  const syncSequenceRef = useRef(0)
  const syncControllerRef = useRef<AbortController | null>(null)
  const usuarioIdRef = useRef<string | null>(usuario?.id ?? null)
  usuarioIdRef.current = usuario?.id ?? null

  const sincronizarAlertas = useCallback(async (): Promise<void> => {
    if (!usuario?.roles.includes('MESERO')) return

    syncControllerRef.current?.abort()
    const controller = new AbortController()
    syncControllerRef.current = controller
    const sequence = syncSequenceRef.current + 1
    syncSequenceRef.current = sequence
    const usuarioId = usuario.id

    try {
      const mesas = await mesasApi.getMesas({ signal: controller.signal })
      const mesasPropias = mesas.filter(
        (mesa) =>
          mesa.estado === 'OCUPADA' && mesa.meseroActual?.id === usuario.id
      )
      const ordenesPorMesa = await Promise.all(
        mesasPropias.map(async (mesa) => ({
          mesa,
          ordenes: await ordenesApi.getOrdenesMesa(mesa.id, {
            signal: controller.signal,
          }),
        }))
      )
      if (
        controller.signal.aborted ||
        syncSequenceRef.current !== sequence ||
        usuarioIdRef.current !== usuarioId
      ) {
        return
      }
      setAlertOwnerId(usuarioId)
      setAlertas(
        ordenesPorMesa.flatMap(({ mesa, ordenes }) =>
          ordenes
            .filter((orden) => orden.estadoGeneral === 'LISTA')
            .map((orden) => ({
              ordenId: orden.id,
              mesaId: mesa.id,
              mesaNumero: mesa.numero,
              tipo: orden.tipo,
              timestamp: orden.createdAt,
            }))
        )
      )
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      // Un fallo de sincronización no elimina alertas ya recibidas por WS.
    }
  }, [usuario])

  useEffect(() => {
    if (!usuario?.roles.includes('MESERO')) {
      setAlertas([])
      setAlertOwnerId(null)
      return
    }
    if (alertOwnerId !== usuario.id) {
      syncSequenceRef.current += 1
      syncControllerRef.current?.abort()
      setAlertas([])
      setAlertOwnerId(usuario.id)
    }
    if (!socket) return

    const sync = (): void => {
      void sincronizarAlertas()
    }

    const handleOrdenActualizada = (payload: unknown): void => {
      if (!isOrdenActualizadaEvent(payload)) return
      if (payload.meseroId !== usuario.id || payload.nuevoEstado !== 'LISTA') {
        return
      }

      setAlertas((current) => {
        const alerta: ReadyOrderAlert = {
          ordenId: payload.ordenId,
          mesaId: payload.mesaId,
          mesaNumero: payload.mesaNumero,
          tipo: payload.tipo,
          timestamp: payload.timestamp,
        }
        return [
          ...current.filter((item) => item.ordenId !== payload.ordenId),
          alerta,
        ]
      })
      setAlertOwnerId(usuario.id)
      toast.success(
        `Mesa ${payload.mesaNumero}: ${payload.tipo === 'COCINA' ? 'comida' : 'bebida'} lista para entregar`
      )
      void playAlertSound()
    }

    void sincronizarAlertas()
    socket.on(WS_EVENTS.connect, sync)
    socket.on(WS_EVENTS.ordenActualizada, handleOrdenActualizada)
    window.addEventListener('focus', sync)
    return () => {
      syncSequenceRef.current += 1
      syncControllerRef.current?.abort()
      socket.off(WS_EVENTS.connect, sync)
      socket.off(WS_EVENTS.ordenActualizada, handleOrdenActualizada)
      window.removeEventListener('focus', sync)
    }
  }, [alertOwnerId, playAlertSound, sincronizarAlertas, socket, toast, usuario])

  const descartarOrden = useCallback((ordenId: string): void => {
    syncSequenceRef.current += 1
    syncControllerRef.current?.abort()
    setAlertas((current) => current.filter((item) => item.ordenId !== ordenId))
  }, [])

  const alertasVisibles = useMemo(
    () => (alertOwnerId === usuario?.id ? alertas : []),
    [alertOwnerId, alertas, usuario?.id]
  )

  const totalPorMesa = useCallback(
    (mesaId: string): number =>
      alertasVisibles.filter((alerta) => alerta.mesaId === mesaId).length,
    [alertasVisibles]
  )

  const value = useMemo<ReadyOrdersContextValue>(
    () => ({
      alertas: alertasVisibles,
      total: alertasVisibles.length,
      totalPorMesa,
      descartarOrden,
    }),
    [alertasVisibles, descartarOrden, totalPorMesa]
  )

  return (
    <ReadyOrdersContext.Provider value={value}>
      {children}
    </ReadyOrdersContext.Provider>
  )
}

export function useReadyOrders(): ReadyOrdersContextValue {
  const value = useContext(ReadyOrdersContext)
  if (!value) {
    throw new Error('useReadyOrders debe usarse dentro de ReadyOrdersProvider')
  }
  return value
}
