'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClientError } from '../api/client'
import { productosApi } from '../api/productos'
import type { Producto } from '../types'
interface UseProductosReturn {
  productos: Producto[]
  comida: Producto[]
  bebida: Producto[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}
export function useProductos(): UseProductosReturn {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setProductos(await productosApi.getDisponibles({ signal }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Error inesperado al cargar productos'
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
  const comida = useMemo(
    () => productos.filter((item) => item.tipo === 'COMIDA'),
    [productos]
  )
  const bebida = useMemo(
    () => productos.filter((item) => item.tipo === 'BEBIDA'),
    [productos]
  )
  return { productos, comida, bebida, loading, error, refetch: () => load() }
}
