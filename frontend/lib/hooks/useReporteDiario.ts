'use client'

import { useCallback, useEffect, useState } from 'react'
import { cajaApi } from '../api/caja'
import { ApiClientError } from '../api/client'
import type { ReporteDiario } from '../types'

interface UseReporteDiarioReturn {
  reporte: ReporteDiario | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useReporteDiario(fecha: string): UseReporteDiarioReturn {
  const [reporte, setReporte] = useState<ReporteDiario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        setLoading(true)
        setError(null)
        setReporte(await cajaApi.getReporteDiario(fecha, { signal }))
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Error inesperado al cargar reportes'
        )
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [fecha]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { reporte, loading, error, refetch: () => load() }
}
