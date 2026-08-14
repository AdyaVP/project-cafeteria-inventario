'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../api/client'
import { ordenesApi } from '../api/ordenes'
import type { CrearOrdenDto, Orden } from '../types'
interface UseOrdenesReturn {
  ordenes: Orden[]
  loading: boolean
  error: string | null
  crearOrden: (dto: CrearOrdenDto) => Promise<Orden[]>
  getOrdenesMesa: (mesaId: string) => Promise<Orden[]>
}
export function useOrdenes(): UseOrdenesReturn {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => controllerRef.current?.abort(), [])
  const getOrdenesMesa = useCallback(
    async (mesaId: string): Promise<Orden[]> => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      try {
        setLoading(true)
        setError(null)
        setOrdenes([])
        const data = await ordenesApi.getOrdenesMesa(mesaId, {
          signal: controller.signal,
        })
        setOrdenes(data)
        return data
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return []
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Error inesperado al cargar las órdenes'
        setError(message)
        throw err
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    []
  )
  const crearOrden = useCallback(
    async (dto: CrearOrdenDto): Promise<Orden[]> => {
      try {
        setLoading(true)
        setError(null)
        const data = await ordenesApi.crearOrden(dto)
        setOrdenes((current) => [...current, ...data])
        return data
      } catch (err: unknown) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Error inesperado al crear la orden'
        )
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )
  return { ordenes, loading, error, crearOrden, getOrdenesMesa }
}
