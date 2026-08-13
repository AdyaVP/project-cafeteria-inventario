'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiClientError } from '../api/client'
import { inventarioApi } from '../api/inventario'
import type {
  AjustarStockDto,
  CrearInventarioItemDto,
  InventarioItem,
} from '../types'

interface UseInventarioReturn {
  items: InventarioItem[]
  alertas: InventarioItem[]
  loading: boolean
  saving: boolean
  error: string | null
  refetch: () => Promise<void>
  crear: (dto: CrearInventarioItemDto) => Promise<InventarioItem>
  ajustarStock: (id: string, dto: AjustarStockDto) => Promise<InventarioItem>
}

function mensajeError(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

function ordenar(items: InventarioItem[]): InventarioItem[] {
  return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function useInventario(): UseInventarioReturn {
  const [items, setItems] = useState<InventarioItem[]>([])
  const [alertas, setAlertas] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      const [inventario, stockBajo] = await Promise.all([
        inventarioApi.getAll({ signal }),
        inventarioApi.getAlertas({ signal }),
      ])
      setItems(ordenar(inventario))
      setAlertas(ordenar(stockBajo))
    } catch (loadError: unknown) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return
      setError(mensajeError(loadError, 'No fue posible cargar el inventario'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const sincronizar = (actualizado: InventarioItem): void => {
    setItems((current) =>
      ordenar([
        ...current.filter((item) => item.id !== actualizado.id),
        actualizado,
      ])
    )
    setAlertas((current) => {
      const restantes = current.filter((item) => item.id !== actualizado.id)
      return actualizado.stockActual <= actualizado.stockMinimo
        ? ordenar([...restantes, actualizado])
        : restantes
    })
  }

  const crear = async (
    dto: CrearInventarioItemDto
  ): Promise<InventarioItem> => {
    setSaving(true)
    setError(null)
    try {
      const creado = await inventarioApi.crear(dto)
      sincronizar(creado)
      return creado
    } catch (mutationError: unknown) {
      const message = mensajeError(
        mutationError,
        'No fue posible crear el insumo'
      )
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  const ajustarStock = async (
    id: string,
    dto: AjustarStockDto
  ): Promise<InventarioItem> => {
    setSaving(true)
    setError(null)
    try {
      const actualizado = await inventarioApi.ajustarStock(id, dto)
      sincronizar(actualizado)
      return actualizado
    } catch (mutationError: unknown) {
      const message = mensajeError(
        mutationError,
        'No fue posible ajustar el stock'
      )
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  return {
    items,
    alertas,
    loading,
    saving,
    error,
    refetch: () => load(),
    crear,
    ajustarStock,
  }
}
