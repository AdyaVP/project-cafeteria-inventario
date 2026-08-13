'use client'

import { useMemo, useState, type FormEvent } from 'react'
import {
  BookOpen,
  Coffee,
  Pencil,
  Plus,
  Power,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import clsx from 'clsx'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { Select } from '@/components/ui/Select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/lib/context/ToastContext'
import { useAdminCatalogo } from '@/lib/hooks/useAdminCatalogo'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import type {
  InventarioItem,
  Producto,
  ProductoTipo,
  Receta,
  TemperaturaProducto,
} from '@/lib/types'

const NumeroNoNegativoSchema = z
  .string()
  .trim()
  .min(1, 'Campo requerido')
  .refine((value) => Number.isFinite(Number(value)), 'Ingresa un número válido')
  .transform(Number)
  .pipe(z.number().min(0, 'No puede ser negativo'))

const NumeroPositivoSchema = z
  .string()
  .trim()
  .min(1, 'Campo requerido')
  .refine((value) => Number.isFinite(Number(value)), 'Ingresa un número válido')
  .transform(Number)
  .pipe(z.number().positive('Debe ser mayor a cero'))

const CantidadRecetaSchema = z
  .string()
  .trim()
  .min(1, 'Campo requerido')
  .refine((value) => Number.isFinite(Number(value)), 'Ingresa un número válido')
  .transform(Number)
  .pipe(z.number().min(0.01, 'La cantidad mínima es 0.01'))

const NumeroOpcionalSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || Number.isFinite(Number(value)),
    'Ingresa un número válido'
  )
  .transform((value) => (value === '' ? undefined : Number(value)))
  .pipe(z.number().min(0, 'No puede ser negativo').optional())

function esUrlOpcional(value: string): boolean {
  if (!value) return true
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const ProductoBaseFormSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(100),
  descripcion: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || undefined),
  precio: NumeroNoNegativoSchema,
  disponible: z.boolean(),
  imagenUrl: z
    .string()
    .trim()
    .refine(esUrlOpcional, 'Ingresa una URL válida')
    .transform((value) => value || undefined),
})

const CrearProductoFormSchema = z.discriminatedUnion('tipo', [
  ProductoBaseFormSchema.extend({
    tipo: z.literal('COMIDA'),
    tiempoPreparacionMin: NumeroPositivoSchema,
    calorias: NumeroOpcionalSchema,
    alergenos: z.string().transform((value) =>
      Array.from(
        new Set(
          value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        )
      )
    ),
  }),
  ProductoBaseFormSchema.extend({
    tipo: z.literal('BEBIDA'),
    temperatura: z.enum(['FRIA', 'CALIENTE', 'AMBIENTE']),
    tamanosDisponibles: z
      .array(
        z.object({
          nombre: z.string().trim().min(1, 'Indica el nombre del tamaño'),
          precioAdicional: NumeroNoNegativoSchema,
        })
      )
      .min(1, 'Agrega al menos un tamaño'),
  }),
])

const EditarProductoFormSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(100),
  descripcion: z.string().trim().max(500),
  precio: NumeroNoNegativoSchema,
  imagenUrl: z.string().trim().refine(esUrlOpcional, 'Ingresa una URL válida'),
})

const RecetaFormSchema = z
  .object({
    productoId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Selecciona un producto válido'),
    ingredientes: z
      .array(
        z.object({
          inventarioItemId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Selecciona un insumo válido'),
          cantidad: CantidadRecetaSchema,
        })
      )
      .min(1, 'Agrega al menos un ingrediente')
      .max(100, 'La receta no puede tener más de 100 ingredientes'),
  })
  .superRefine((data, context) => {
    const ids = data.ingredientes.map((item) => item.inventarioItemId)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['ingredientes'],
        message: 'No repitas el mismo insumo en la receta',
      })
    }
  })

const SeleccionarProductoRecetaSchema = z.object({
  productoId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Selecciona una comida sin receta'),
})

interface ProductoFormState {
  tipo: ProductoTipo
  nombre: string
  descripcion: string
  precio: string
  disponible: boolean
  imagenUrl: string
  tiempoPreparacionMin: string
  calorias: string
  alergenos: string
  temperatura: TemperaturaProducto
  tamanosDisponibles: Array<{ nombre: string; precioAdicional: string }>
}

interface ProductoFormErrors {
  nombre?: string
  descripcion?: string
  precio?: string
  imagenUrl?: string
  tiempoPreparacionMin?: string
  calorias?: string
  temperatura?: string
  tamanosDisponibles?: string
}

interface EditarFormState {
  nombre: string
  descripcion: string
  precio: string
  imagenUrl: string
}

interface RecetaIngredienteForm {
  inventarioItemId: string
  cantidad: string
}

const EMPTY_PRODUCT_FORM: ProductoFormState = {
  tipo: 'COMIDA',
  nombre: '',
  descripcion: '',
  precio: '',
  disponible: false,
  imagenUrl: '',
  tiempoPreparacionMin: '',
  calorias: '',
  alergenos: '',
  temperatura: 'FRIA',
  tamanosDisponibles: [{ nombre: 'Regular', precioAdicional: '0' }],
}

export default function MenuPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN'])
  if (loading || !autorizado) return null
  return <MenuContent />
}

function MenuContent(): React.JSX.Element {
  const {
    productos,
    recetas,
    inventario,
    loading,
    saving,
    error,
    refetch,
    crearProducto,
    actualizarProducto,
    toggleDisponibilidad,
    crearReceta,
    actualizarReceta,
  } = useAdminCatalogo()
  const { toast } = useToast()
  const [filtro, setFiltro] = useState<'TODOS' | ProductoTipo>('TODOS')
  const [createOpen, setCreateOpen] = useState(false)
  const [productoForm, setProductoForm] =
    useState<ProductoFormState>(EMPTY_PRODUCT_FORM)
  const [productoErrors, setProductoErrors] = useState<ProductoFormErrors>({})
  const [editando, setEditando] = useState<Producto | null>(null)
  const [editarForm, setEditarForm] = useState<EditarFormState>({
    nombre: '',
    descripcion: '',
    precio: '',
    imagenUrl: '',
  })
  const [editarErrors, setEditarErrors] = useState<ProductoFormErrors>({})
  const [productoReceta, setProductoReceta] = useState<Producto | null>(null)
  const [recetaEditando, setRecetaEditando] = useState<Receta | null>(null)
  const [ingredientes, setIngredientes] = useState<RecetaIngredienteForm[]>([
    { inventarioItemId: '', cantidad: '' },
  ])
  const [recetaError, setRecetaError] = useState<string>()
  const [recetaVista, setRecetaVista] = useState<Receta | null>(null)
  const [selectorRecetaOpen, setSelectorRecetaOpen] = useState(false)
  const [selectorProductoId, setSelectorProductoId] = useState('')
  const [selectorRecetaError, setSelectorRecetaError] = useState<string>()

  const recetasPorProducto = useMemo(
    () => new Map(recetas.map((receta) => [receta.productoId, receta])),
    [recetas]
  )
  const inventarioPorId = useMemo(
    () => new Map(inventario.map((item) => [item.id, item])),
    [inventario]
  )
  const comidasSinReceta = useMemo(
    () =>
      productos.filter(
        (producto) =>
          producto.tipo === 'COMIDA' && !recetasPorProducto.has(producto.id)
      ),
    [productos, recetasPorProducto]
  )
  const inventarioActivo = useMemo(
    () => inventario.filter((item) => item.activo),
    [inventario]
  )
  const visibles =
    filtro === 'TODOS'
      ? productos
      : productos.filter((producto) => producto.tipo === filtro)

  const submitCrear = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    const formSeguro =
      productoForm.tipo === 'COMIDA'
        ? { ...productoForm, disponible: false }
        : productoForm
    const result = CrearProductoFormSchema.safeParse(formSeguro)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setProductoErrors({
        nombre: fields.nombre?.[0],
        descripcion: fields.descripcion?.[0],
        precio: fields.precio?.[0],
        imagenUrl: fields.imagenUrl?.[0],
        tiempoPreparacionMin:
          'tiempoPreparacionMin' in fields
            ? fields.tiempoPreparacionMin?.[0]
            : undefined,
        calorias: 'calorias' in fields ? fields.calorias?.[0] : undefined,
        temperatura:
          'temperatura' in fields ? fields.temperatura?.[0] : undefined,
        tamanosDisponibles:
          'tamanosDisponibles' in fields
            ? fields.tamanosDisponibles?.[0]
            : undefined,
      })
      return
    }
    setProductoErrors({})
    try {
      await crearProducto(result.data)
      toast.success('Producto creado correctamente')
      setProductoForm(EMPTY_PRODUCT_FORM)
      setCreateOpen(false)
    } catch (createError: unknown) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : 'No fue posible crear el producto'
      )
    }
  }

  const abrirEdicion = (producto: Producto): void => {
    setEditando(producto)
    setEditarForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio: String(producto.precio),
      imagenUrl: producto.imagenUrl ?? '',
    })
    setEditarErrors({})
  }

  const submitEditar = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    if (!editando) return
    const result = EditarProductoFormSchema.safeParse(editarForm)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setEditarErrors({
        nombre: fields.nombre?.[0],
        descripcion: fields.descripcion?.[0],
        precio: fields.precio?.[0],
        imagenUrl: fields.imagenUrl?.[0],
      })
      return
    }
    setEditarErrors({})
    try {
      await actualizarProducto(editando.id, result.data)
      toast.success('Producto actualizado correctamente')
      setEditando(null)
    } catch (updateError: unknown) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : 'No fue posible actualizar el producto'
      )
    }
  }

  const cambiarDisponibilidad = async (producto: Producto): Promise<void> => {
    if (
      producto.tipo === 'COMIDA' &&
      !producto.disponible &&
      !recetasPorProducto.has(producto.id)
    ) {
      toast.warning('Asocia una receta antes de activar esta comida')
      return
    }
    try {
      const actualizado = await toggleDisponibilidad(producto.id)
      toast.success(
        actualizado.disponible
          ? `${actualizado.nombre} está disponible`
          : `${actualizado.nombre} fue pausado`
      )
    } catch (toggleError: unknown) {
      toast.error(
        toggleError instanceof Error
          ? toggleError.message
          : 'No fue posible cambiar la disponibilidad'
      )
    }
  }

  const abrirReceta = (producto: Producto): void => {
    const existente = recetasPorProducto.get(producto.id)
    if (existente) {
      setRecetaVista(existente)
      return
    }
    abrirEditorReceta(producto)
  }

  const abrirEditorReceta = (producto: Producto, receta?: Receta): void => {
    setProductoReceta(producto)
    setRecetaEditando(receta ?? null)
    setIngredientes(
      receta
        ? receta.ingredientes.map((ingrediente) => ({
            inventarioItemId: ingrediente.inventarioItemId,
            cantidad: String(ingrediente.cantidad),
          }))
        : [{ inventarioItemId: '', cantidad: '' }]
    )
    setRecetaVista(null)
    setRecetaError(undefined)
  }

  const cerrarEditorReceta = (): void => {
    setProductoReceta(null)
    setRecetaEditando(null)
    setIngredientes([{ inventarioItemId: '', cantidad: '' }])
    setRecetaError(undefined)
  }

  const cerrarSelectorReceta = (): void => {
    setSelectorRecetaOpen(false)
    setSelectorProductoId('')
    setSelectorRecetaError(undefined)
  }

  const abrirEdicionReceta = (receta: Receta): void => {
    const producto = productos.find((item) => item.id === receta.productoId)
    if (!producto) {
      toast.error('No se encontró el producto asociado a la receta')
      return
    }
    abrirEditorReceta(producto, receta)
  }

  const submitSelectorReceta = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const result = SeleccionarProductoRecetaSchema.safeParse({
      productoId: selectorProductoId,
    })
    if (!result.success) {
      setSelectorRecetaError(result.error.flatten().fieldErrors.productoId?.[0])
      return
    }

    const producto = comidasSinReceta.find(
      (item) => item.id === result.data.productoId
    )
    if (!producto) {
      setSelectorRecetaError('La comida seleccionada ya tiene una receta')
      return
    }

    cerrarSelectorReceta()
    abrirEditorReceta(producto)
  }

  const submitReceta = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    if (!productoReceta) return
    const result = RecetaFormSchema.safeParse({
      productoId: productoReceta.id,
      ingredientes,
    })
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setRecetaError(fields.productoId?.[0] ?? fields.ingredientes?.[0])
      return
    }
    setRecetaError(undefined)
    try {
      if (recetaEditando) {
        await actualizarReceta(productoReceta.id, {
          ingredientes: result.data.ingredientes,
        })
        toast.success('Receta actualizada correctamente')
      } else {
        await crearReceta(result.data)
        toast.success('Receta asociada correctamente')
      }
      cerrarEditorReceta()
    } catch (recipeError: unknown) {
      const message =
        recipeError instanceof Error
          ? recipeError.message
          : recetaEditando
            ? 'No fue posible actualizar la receta'
            : 'No fue posible asociar la receta'
      setRecetaError(message)
      toast.error(message)
    }
  }

  const updateTamano = (
    index: number,
    field: 'nombre' | 'precioAdicional',
    value: string
  ): void => {
    setProductoForm((current) => ({
      ...current,
      tamanosDisponibles: current.tamanosDisponibles.map(
        (tamano, currentIndex) =>
          currentIndex === index ? { ...tamano, [field]: value } : tamano
      ),
    }))
  }

  const updateIngrediente = (
    index: number,
    field: keyof RecetaIngredienteForm,
    value: string
  ): void => {
    setIngredientes((current) =>
      current.map((ingrediente, currentIndex) =>
        currentIndex === index
          ? { ...ingrediente, [field]: value }
          : ingrediente
      )
    )
  }

  if (loading && productos.length === 0) return <MenuSkeleton />
  if (error && productos.length === 0) {
    return <DataError message={error} onRetry={() => void refetch()} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Gestión de menú</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Productos de comida y bebida, disponibilidad y consumo por receta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<BookOpen size={16} />}
            onClick={() => {
              setSelectorRecetaOpen(true)
              setSelectorRecetaError(undefined)
            }}
          >
            Nueva receta
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Nuevo producto
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Productos
          </p>
          <p className="mt-2 text-3xl font-bold">{productos.length}</p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Disponibles
          </p>
          <p className="mt-2 text-3xl font-bold text-state-success">
            {productos.filter((producto) => producto.disponible).length}
          </p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Recetas asociadas
          </p>
          <p className="mt-2 text-3xl font-bold">{recetas.length}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['TODOS', 'COMIDA', 'BEBIDA'] as const).map((tipo) => (
          <Button
            key={tipo}
            size="sm"
            variant={filtro === tipo ? 'primary' : 'secondary'}
            aria-pressed={filtro === tipo}
            onClick={() => setFiltro(tipo)}
          >
            {tipo === 'TODOS'
              ? 'Todos'
              : tipo === 'COMIDA'
                ? 'Comida'
                : 'Bebida'}
          </Button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={42} />}
            title="No hay productos en esta categoría"
          />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo / detalle</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Receta</TableHead>
              <TableHead>Disponibilidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((producto) => {
              const receta = recetasPorProducto.get(producto.id)
              return (
                <TableRow key={producto.id}>
                  <TableCell>
                    <p className="font-semibold">{producto.nombre}</p>
                    <p className="mt-0.5 max-w-xs truncate text-xs text-text-secondary">
                      {producto.descripcion || 'Sin descripción'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {producto.tipo === 'COMIDA' ? (
                        <UtensilsCrossed
                          size={15}
                          className="text-state-warning"
                        />
                      ) : (
                        <Coffee size={15} className="text-state-info" />
                      )}
                      <span className="text-sm">
                        {producto.tipo === 'COMIDA'
                          ? `${producto.tiempoPreparacionMin} min`
                          : producto.temperatura}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <PriceDisplay size="sm" amount={producto.precio} />
                  </TableCell>
                  <TableCell>
                    {producto.tipo === 'BEBIDA' ? (
                      <span className="text-xs text-text-disabled">
                        No aplica
                      </span>
                    ) : receta ? (
                      <button
                        type="button"
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
                        aria-label={`Ver receta de ${producto.nombre}`}
                        onClick={() => setRecetaVista(receta)}
                      >
                        <Badge
                          variant="success"
                          label={`${receta.ingredientes.length} ingredientes`}
                        />
                      </button>
                    ) : (
                      <Badge variant="warning" label="Pendiente" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={producto.disponible ? 'success' : 'cerrada'}
                      label={producto.disponible ? 'Disponible' : 'Pausado'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {producto.tipo === 'COMIDA' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<BookOpen size={14} />}
                          disabled={
                            saving || (!receta && inventario.length === 0)
                          }
                          onClick={() => abrirReceta(producto)}
                        >
                          {receta ? 'Ver receta' : 'Receta'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Pencil size={14} />}
                        disabled={saving}
                        onClick={() => abrirEdicion(producto)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant={producto.disponible ? 'danger' : 'secondary'}
                        icon={<Power size={14} />}
                        disabled={saving}
                        onClick={() => void cambiarDisponibilidad(producto)}
                      >
                        {producto.disponible ? 'Pausar' : 'Activar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo producto"
        size="lg"
      >
        <form
          className="space-y-5"
          onSubmit={(event) => void submitCrear(event)}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              name="tipo"
              label="Tipo de producto"
              value={productoForm.tipo}
              onChange={(event) =>
                setProductoForm((current) => ({
                  ...current,
                  tipo: event.target.value as ProductoTipo,
                  disponible:
                    event.target.value === 'COMIDA'
                      ? false
                      : current.disponible,
                }))
              }
            >
              <option value="COMIDA">Comida</option>
              <option value="BEBIDA">Bebida</option>
            </Select>
            <Input
              name="nombre"
              label="Nombre"
              value={productoForm.nombre}
              error={productoErrors.nombre}
              onChange={(event) =>
                setProductoForm((current) => ({
                  ...current,
                  nombre: event.target.value,
                }))
              }
            />
          </div>
          <Textarea
            name="descripcion"
            label="Descripción (opcional)"
            value={productoForm.descripcion}
            error={productoErrors.descripcion}
            onChange={(event) =>
              setProductoForm((current) => ({
                ...current,
                descripcion: event.target.value,
              }))
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="precio"
              label="Precio base (L.)"
              inputMode="decimal"
              value={productoForm.precio}
              error={productoErrors.precio}
              onChange={(event) =>
                setProductoForm((current) => ({
                  ...current,
                  precio: event.target.value,
                }))
              }
            />
            <Input
              name="imagenUrl"
              label="URL de imagen (opcional)"
              type="url"
              value={productoForm.imagenUrl}
              error={productoErrors.imagenUrl}
              onChange={(event) =>
                setProductoForm((current) => ({
                  ...current,
                  imagenUrl: event.target.value,
                }))
              }
            />
          </div>

          {productoForm.tipo === 'COMIDA' ? (
            <div className="space-y-4 rounded-lg border border-border-subtle bg-bg-elevated/30 p-4">
              <h3 className="text-sm font-semibold">Preparación de comida</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="tiempoPreparacionMin"
                  label="Tiempo (minutos)"
                  inputMode="numeric"
                  value={productoForm.tiempoPreparacionMin}
                  error={productoErrors.tiempoPreparacionMin}
                  onChange={(event) =>
                    setProductoForm((current) => ({
                      ...current,
                      tiempoPreparacionMin: event.target.value,
                    }))
                  }
                />
                <Input
                  name="calorias"
                  label="Calorías (opcional)"
                  inputMode="numeric"
                  value={productoForm.calorias}
                  error={productoErrors.calorias}
                  onChange={(event) =>
                    setProductoForm((current) => ({
                      ...current,
                      calorias: event.target.value,
                    }))
                  }
                />
              </div>
              <Input
                name="alergenos"
                label="Alérgenos (separados por coma)"
                value={productoForm.alergenos}
                placeholder="gluten, lactosa"
                onChange={(event) =>
                  setProductoForm((current) => ({
                    ...current,
                    alergenos: event.target.value,
                  }))
                }
              />
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-border-subtle bg-bg-elevated/30 p-4">
              <Select
                name="temperatura"
                label="Temperatura"
                value={productoForm.temperatura}
                error={productoErrors.temperatura}
                onChange={(event) =>
                  setProductoForm((current) => ({
                    ...current,
                    temperatura: event.target.value as TemperaturaProducto,
                  }))
                }
              >
                <option value="FRIA">Fría</option>
                <option value="CALIENTE">Caliente</option>
                <option value="AMBIENTE">Ambiente</option>
              </Select>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Tamaños</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={<Plus size={14} />}
                  onClick={() =>
                    setProductoForm((current) => ({
                      ...current,
                      tamanosDisponibles: [
                        ...current.tamanosDisponibles,
                        { nombre: '', precioAdicional: '0' },
                      ],
                    }))
                  }
                >
                  Agregar tamaño
                </Button>
              </div>
              {productoForm.tamanosDisponibles.map((tamano, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                >
                  <Input
                    label="Nombre"
                    value={tamano.nombre}
                    onChange={(event) =>
                      updateTamano(index, 'nombre', event.target.value)
                    }
                  />
                  <Input
                    label="Precio adicional"
                    inputMode="decimal"
                    value={tamano.precioAdicional}
                    onChange={(event) =>
                      updateTamano(index, 'precioAdicional', event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Quitar tamaño"
                    disabled={productoForm.tamanosDisponibles.length === 1}
                    className="justify-self-end sm:justify-self-auto"
                    onClick={() =>
                      setProductoForm((current) => ({
                        ...current,
                        tamanosDisponibles: current.tamanosDisponibles.filter(
                          (_, currentIndex) => currentIndex !== index
                        ),
                      }))
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
              {productoErrors.tamanosDisponibles && (
                <p className="text-[11px] text-state-error">
                  {productoErrors.tamanosDisponibles}
                </p>
              )}
            </div>
          )}

          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={productoForm.disponible}
              disabled={productoForm.tipo === 'COMIDA'}
              onChange={(event) =>
                setProductoForm((current) => ({
                  ...current,
                  disponible: event.target.checked,
                }))
              }
              className="accent-accent"
            />
            {productoForm.tipo === 'COMIDA'
              ? 'Se habilita después de asociar su receta'
              : 'Disponible desde su creación'}
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Crear producto
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title="Editar producto"
        description="El tipo y sus detalles no pueden cambiarse después de crear el producto."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submitEditar(event)}
          noValidate
        >
          <Input
            name="nombre"
            label="Nombre"
            value={editarForm.nombre}
            error={editarErrors.nombre}
            onChange={(event) =>
              setEditarForm((current) => ({
                ...current,
                nombre: event.target.value,
              }))
            }
          />
          <Textarea
            name="descripcion"
            label="Descripción"
            value={editarForm.descripcion}
            error={editarErrors.descripcion}
            onChange={(event) =>
              setEditarForm((current) => ({
                ...current,
                descripcion: event.target.value,
              }))
            }
          />
          <Input
            name="precio"
            label="Precio (L.)"
            inputMode="decimal"
            value={editarForm.precio}
            error={editarErrors.precio}
            onChange={(event) =>
              setEditarForm((current) => ({
                ...current,
                precio: event.target.value,
              }))
            }
          />
          <Input
            name="imagenUrl"
            label="URL de imagen"
            type="url"
            value={editarForm.imagenUrl}
            error={editarErrors.imagenUrl}
            onChange={(event) =>
              setEditarForm((current) => ({
                ...current,
                imagenUrl: event.target.value,
              }))
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditando(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={selectorRecetaOpen}
        onClose={cerrarSelectorReceta}
        title="Nueva receta"
        description="Selecciona una comida que todavía no tenga consumo de inventario asociado."
      >
        {comidasSinReceta.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={<BookOpen size={40} />}
              title="No hay comidas pendientes de receta"
              description="Crea una comida nueva o usa Editar receta desde el detalle de una receta existente."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={cerrarSelectorReceta}>
                Entendido
              </Button>
              <Button disabled>No hay comidas disponibles</Button>
            </div>
          </div>
        ) : inventarioActivo.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={<BookOpen size={40} />}
              title="No hay insumos activos"
              description="Registra o activa al menos un insumo en Inventario antes de crear una receta."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cerrarSelectorReceta}>
                Cerrar
              </Button>
              <Button disabled>Nueva receta no disponible</Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={submitSelectorReceta}
            noValidate
          >
            <Select
              name="productoId"
              label="Comida sin receta"
              value={selectorProductoId}
              error={selectorRecetaError}
              onChange={(event) => {
                setSelectorProductoId(event.target.value)
                setSelectorRecetaError(undefined)
              }}
            >
              <option value="">Selecciona una comida</option>
              {comidasSinReceta.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={cerrarSelectorReceta}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!selectorProductoId}>
                Definir ingredientes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!productoReceta}
        onClose={cerrarEditorReceta}
        title={recetaEditando ? 'Editar receta' : 'Asociar receta'}
        description={
          productoReceta
            ? `${recetaEditando ? 'Actualiza' : 'Define'} el consumo de inventario por una unidad de ${productoReceta.nombre}.`
            : undefined
        }
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submitReceta(event)}
          noValidate
        >
          {ingredientes.map((ingrediente, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
            >
              <Select
                label="Insumo"
                value={ingrediente.inventarioItemId}
                onChange={(event) =>
                  updateIngrediente(
                    index,
                    'inventarioItemId',
                    event.target.value
                  )
                }
              >
                <option value="">Selecciona un insumo</option>
                {inventario.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.activo}>
                    {item.nombre} ({item.unidad})
                    {item.activo ? '' : ' — inactivo'}
                  </option>
                ))}
              </Select>
              <Input
                label="Cantidad"
                inputMode="decimal"
                value={ingrediente.cantidad}
                onChange={(event) =>
                  updateIngrediente(index, 'cantidad', event.target.value)
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Quitar ingrediente"
                disabled={ingredientes.length === 1}
                className="justify-self-end sm:justify-self-auto"
                onClick={() =>
                  setIngredientes((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index)
                  )
                }
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          {recetaError && (
            <p className="text-[11px] text-state-error">{recetaError}</p>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Plus size={14} />}
            disabled={ingredientes.length >= 100}
            onClick={() =>
              setIngredientes((current) => [
                ...current,
                { inventarioItemId: '', cantidad: '' },
              ])
            }
          >
            Agregar ingrediente
          </Button>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={cerrarEditorReceta}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {recetaEditando ? 'Guardar cambios' : 'Guardar receta'}
            </Button>
          </div>
        </form>
      </Modal>

      <RecetaDetalleModal
        receta={recetaVista}
        productos={productos}
        inventarioPorId={inventarioPorId}
        onClose={() => setRecetaVista(null)}
        onEdit={abrirEdicionReceta}
      />
    </div>
  )
}

interface RecetaDetalleModalProps {
  receta: Receta | null
  productos: Producto[]
  inventarioPorId: Map<string, InventarioItem>
  onClose: () => void
  onEdit: (receta: Receta) => void
}

function RecetaDetalleModal({
  receta,
  productos,
  inventarioPorId,
  onClose,
  onEdit,
}: RecetaDetalleModalProps): React.JSX.Element {
  const producto = receta
    ? productos.find((item) => item.id === receta.productoId)
    : undefined
  return (
    <Modal
      open={!!receta}
      onClose={onClose}
      title={`Receta${producto ? `: ${producto.nombre}` : ''}`}
      description="Las cantidades corresponden a una unidad del producto."
      size="sm"
    >
      <div className="space-y-2">
        {receta?.ingredientes.map((ingrediente) => {
          const item = inventarioPorId.get(ingrediente.inventarioItemId)
          return (
            <div
              key={ingrediente.inventarioItemId}
              className="flex items-center justify-between rounded-md bg-bg-elevated px-3 py-2 text-sm"
            >
              <span>{item?.nombre ?? 'Insumo no disponible'}</span>
              <span
                className={clsx('font-mono', !item && 'text-state-warning')}
              >
                {ingrediente.cantidad} {item?.unidad ?? ''}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-border-subtle pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          icon={<Pencil size={15} />}
          disabled={!receta}
          onClick={() => {
            if (receta) onEdit(receta)
          }}
        >
          Editar receta
        </Button>
      </div>
    </Modal>
  )
}

function MenuSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded bg-bg-surface" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded bg-bg-surface"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded bg-bg-surface" />
    </div>
  )
}
