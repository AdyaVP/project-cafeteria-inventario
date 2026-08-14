'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiClientError } from '../api/client'
import { inventarioApi } from '../api/inventario'
import { productosApi } from '../api/productos'
import { recetasApi } from '../api/recetas'
import type {
  ActualizarProductoDto,
  ActualizarRecetaDto,
  CrearProductoDto,
  CrearRecetaDto,
  InventarioItem,
  Producto,
  Receta,
} from '../types'

interface UseAdminCatalogoReturn {
  productos: Producto[]
  recetas: Receta[]
  inventario: InventarioItem[]
  loading: boolean
  saving: boolean
  error: string | null
  refetch: () => Promise<void>
  crearProducto: (dto: CrearProductoDto) => Promise<Producto>
  actualizarProducto: (
    id: string,
    dto: ActualizarProductoDto
  ) => Promise<Producto>
  toggleDisponibilidad: (id: string) => Promise<Producto>
  crearReceta: (dto: CrearRecetaDto) => Promise<Receta>
  actualizarReceta: (
    productoId: string,
    dto: ActualizarRecetaDto
  ) => Promise<Receta>
}

function mensajeError(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

function ordenarProductos(productos: Producto[]): Producto[] {
  return [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export function useAdminCatalogo(): UseAdminCatalogoReturn {
  const [productos, setProductos] = useState<Producto[]>([])
  const [recetas, setRecetas] = useState<Receta[]>([])
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      const [productosData, recetasData, inventarioData] = await Promise.all([
        productosApi.getAll({ signal }),
        recetasApi.getAll({ signal }),
        inventarioApi.getAll({ signal }),
      ])
      setProductos(ordenarProductos(productosData))
      setRecetas(recetasData)
      setInventario(
        [...inventarioData].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es')
        )
      )
    } catch (loadError: unknown) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return
      setError(mensajeError(loadError, 'No fue posible cargar el menú'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const ejecutar = async <T>(
    action: () => Promise<T>,
    fallback: string
  ): Promise<T> => {
    setSaving(true)
    setError(null)
    try {
      return await action()
    } catch (mutationError: unknown) {
      const message = mensajeError(mutationError, fallback)
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  const crearProducto = (dto: CrearProductoDto): Promise<Producto> =>
    ejecutar(async () => {
      const creado = await productosApi.crear(dto)
      setProductos((current) => ordenarProductos([...current, creado]))
      return creado
    }, 'No fue posible crear el producto')

  const actualizarProducto = (
    id: string,
    dto: ActualizarProductoDto
  ): Promise<Producto> =>
    ejecutar(async () => {
      const actualizado = await productosApi.actualizar(id, dto)
      setProductos((current) =>
        ordenarProductos(
          current.map((producto) =>
            producto.id === actualizado.id ? actualizado : producto
          )
        )
      )
      return actualizado
    }, 'No fue posible actualizar el producto')

  const toggleDisponibilidad = (id: string): Promise<Producto> =>
    ejecutar(async () => {
      const actualizado = await productosApi.toggleDisponibilidad(id)
      setProductos((current) =>
        current.map((producto) =>
          producto.id === actualizado.id ? actualizado : producto
        )
      )
      return actualizado
    }, 'No fue posible cambiar la disponibilidad')

  const crearReceta = (dto: CrearRecetaDto): Promise<Receta> =>
    ejecutar(async () => {
      const creada = await recetasApi.crear(dto)
      setRecetas((current) => [...current, creada])
      return creada
    }, 'No fue posible asociar la receta')

  const actualizarReceta = (
    productoId: string,
    dto: ActualizarRecetaDto
  ): Promise<Receta> =>
    ejecutar(async () => {
      const actualizada = await recetasApi.actualizar(productoId, dto)
      setRecetas((current) =>
        current.map((receta) =>
          receta.productoId === actualizada.productoId ? actualizada : receta
        )
      )
      return actualizada
    }, 'No fue posible actualizar la receta')

  return {
    productos,
    recetas,
    inventario,
    loading,
    saving,
    error,
    refetch: () => load(),
    crearProducto,
    actualizarProducto,
    toggleDisponibilidad,
    crearReceta,
    actualizarReceta,
  }
}
