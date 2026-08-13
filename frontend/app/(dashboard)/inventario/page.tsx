'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Package, Plus, SlidersHorizontal } from 'lucide-react'
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
import { useToast } from '@/lib/context/ToastContext'
import { useInventario } from '@/lib/hooks/useInventario'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import type {
  InventarioItem,
  OperacionStock,
  UnidadInventario,
} from '@/lib/types'

const UNIDADES: Array<{ value: UnidadInventario; label: string }> = [
  { value: 'KG', label: 'Kilogramo (kg)' },
  { value: 'GR', label: 'Gramo (g)' },
  { value: 'LT', label: 'Litro (L)' },
  { value: 'ML', label: 'Mililitro (ml)' },
  { value: 'UNIDAD', label: 'Unidad' },
]

const NumeroNoNegativoSchema = z
  .string()
  .trim()
  .min(1, 'Campo requerido')
  .refine((value) => Number.isFinite(Number(value)), 'Ingresa un número válido')
  .transform(Number)
  .pipe(z.number().min(0, 'No puede ser negativo'))

const CrearItemFormSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(100),
  unidad: z.enum(['KG', 'GR', 'LT', 'ML', 'UNIDAD']),
  stockActual: NumeroNoNegativoSchema,
  stockMinimo: NumeroNoNegativoSchema,
  costoUnitario: NumeroNoNegativoSchema,
})

const AjustarStockFormSchema = z.object({
  operacion: z.enum(['AGREGAR', 'DESCONTAR']),
  cantidad: z
    .string()
    .trim()
    .min(1, 'Campo requerido')
    .refine(
      (value) => Number.isFinite(Number(value)),
      'Ingresa un número válido'
    )
    .transform(Number)
    .pipe(z.number().positive('La cantidad debe ser mayor a cero')),
})

interface CrearItemErrors {
  nombre?: string
  unidad?: string
  stockActual?: string
  stockMinimo?: string
  costoUnitario?: string
}

const EMPTY_ITEM_FORM = {
  nombre: '',
  unidad: 'UNIDAD' as UnidadInventario,
  stockActual: '',
  stockMinimo: '',
  costoUnitario: '',
}

export default function InventarioPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN'])
  if (loading || !autorizado) return null
  return <InventarioContent />
}

function InventarioContent(): React.JSX.Element {
  const {
    items,
    alertas,
    loading,
    saving,
    error,
    refetch,
    crear,
    ajustarStock,
  } = useInventario()
  const { toast } = useToast()
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [ajustando, setAjustando] = useState<InventarioItem | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)
  const [itemErrors, setItemErrors] = useState<CrearItemErrors>({})
  const [operacion, setOperacion] = useState<OperacionStock>('AGREGAR')
  const [cantidad, setCantidad] = useState('')
  const [ajusteError, setAjusteError] = useState<string>()

  const alertaIds = useMemo(
    () => new Set(alertas.map((item) => item.id)),
    [alertas]
  )
  const visibles = soloAlertas ? alertas : items
  const valorInventario = items.reduce(
    (total, item) => total + item.stockActual * item.costoUnitario,
    0
  )

  const submitCrear = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    const result = CrearItemFormSchema.safeParse(itemForm)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setItemErrors({
        nombre: fields.nombre?.[0],
        unidad: fields.unidad?.[0],
        stockActual: fields.stockActual?.[0],
        stockMinimo: fields.stockMinimo?.[0],
        costoUnitario: fields.costoUnitario?.[0],
      })
      return
    }
    setItemErrors({})
    try {
      await crear(result.data)
      toast.success('Insumo creado correctamente')
      setItemForm(EMPTY_ITEM_FORM)
      setCreateOpen(false)
    } catch (createError: unknown) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : 'No fue posible crear el insumo'
      )
    }
  }

  const submitAjuste = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    if (!ajustando) return
    const result = AjustarStockFormSchema.safeParse({ operacion, cantidad })
    if (!result.success) {
      setAjusteError(result.error.flatten().fieldErrors.cantidad?.[0])
      return
    }
    setAjusteError(undefined)
    try {
      await ajustarStock(ajustando.id, result.data)
      toast.success('Stock actualizado correctamente')
      setAjustando(null)
      setCantidad('')
      setOperacion('AGREGAR')
    } catch (updateError: unknown) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : 'No fue posible ajustar el stock'
      )
    }
  }

  const abrirAjuste = (item: InventarioItem): void => {
    setAjustando(item)
    setCantidad('')
    setOperacion('AGREGAR')
    setAjusteError(undefined)
  }

  if (loading && items.length === 0) return <InventarioSkeleton />
  if (error && items.length === 0) {
    return <DataError message={error} onRetry={() => void refetch()} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Inventario</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Control de existencias, costos y alertas de reposición.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          Nuevo insumo
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Insumos activos
          </p>
          <p className="mt-2 text-3xl font-bold">
            {items.filter((item) => item.activo).length}
          </p>
        </Card>
        <Card
          className={alertas.length > 0 ? 'border-state-warning/50' : undefined}
        >
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Stock mínimo
          </p>
          <p
            className={clsx(
              'mt-2 text-3xl font-bold',
              alertas.length > 0 && 'text-state-warning'
            )}
          >
            {alertas.length}
          </p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Valor estimado
          </p>
          <div className="mt-2">
            <PriceDisplay size="xl" amount={valorInventario} />
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={!soloAlertas ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={!soloAlertas}
          onClick={() => setSoloAlertas(false)}
        >
          Todos ({items.length})
        </Button>
        <Button
          variant={soloAlertas ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={soloAlertas}
          icon={<AlertTriangle size={14} />}
          onClick={() => setSoloAlertas(true)}
        >
          Alertas ({alertas.length})
        </Button>
      </div>

      {visibles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={42} />}
            title={
              soloAlertas
                ? 'No hay alertas de stock'
                : 'No hay insumos registrados'
            }
            description={
              soloAlertas
                ? 'Todos los insumos están por encima de su mínimo.'
                : undefined
            }
          />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Stock mínimo</TableHead>
              <TableHead className="text-right">Costo unitario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((item) => {
              const bajo = alertaIds.has(item.id)
              return (
                <TableRow
                  key={item.id}
                  className={bajo ? 'bg-state-warning/[0.03]' : undefined}
                >
                  <TableCell>
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Unidad: {item.unidad}
                    </p>
                  </TableCell>
                  <TableCell
                    className={clsx(
                      'text-right font-mono font-semibold',
                      bajo && 'text-state-warning'
                    )}
                  >
                    {item.stockActual.toLocaleString('es-HN')} {item.unidad}
                  </TableCell>
                  <TableCell className="text-right font-mono text-text-secondary">
                    {item.stockMinimo.toLocaleString('es-HN')} {item.unidad}
                  </TableCell>
                  <TableCell className="text-right">
                    <PriceDisplay size="sm" amount={item.costoUnitario} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={bajo ? 'warning' : 'success'}
                      label={bajo ? 'Reponer' : 'Disponible'}
                      pulse={bajo}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<SlidersHorizontal size={14} />}
                      disabled={saving}
                      onClick={() => abrirAjuste(item)}
                    >
                      Ajustar
                    </Button>
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
        title="Nuevo insumo"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submitCrear(event)}
          noValidate
        >
          <Input
            name="nombre"
            label="Nombre"
            value={itemForm.nombre}
            error={itemErrors.nombre}
            onChange={(event) =>
              setItemForm((current) => ({
                ...current,
                nombre: event.target.value,
              }))
            }
          />
          <Select
            name="unidad"
            label="Unidad de medida"
            value={itemForm.unidad}
            error={itemErrors.unidad}
            onChange={(event) =>
              setItemForm((current) => ({
                ...current,
                unidad: event.target.value as UnidadInventario,
              }))
            }
          >
            {UNIDADES.map((unidad) => (
              <option key={unidad.value} value={unidad.value}>
                {unidad.label}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="stockActual"
              label="Stock inicial"
              inputMode="decimal"
              value={itemForm.stockActual}
              error={itemErrors.stockActual}
              onChange={(event) =>
                setItemForm((current) => ({
                  ...current,
                  stockActual: event.target.value,
                }))
              }
            />
            <Input
              name="stockMinimo"
              label="Stock mínimo"
              inputMode="decimal"
              value={itemForm.stockMinimo}
              error={itemErrors.stockMinimo}
              onChange={(event) =>
                setItemForm((current) => ({
                  ...current,
                  stockMinimo: event.target.value,
                }))
              }
            />
          </div>
          <Input
            name="costoUnitario"
            label="Costo unitario (L.)"
            inputMode="decimal"
            value={itemForm.costoUnitario}
            error={itemErrors.costoUnitario}
            onChange={(event) =>
              setItemForm((current) => ({
                ...current,
                costoUnitario: event.target.value,
              }))
            }
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar insumo
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!ajustando}
        onClose={() => setAjustando(null)}
        title="Ajustar stock"
        description={
          ajustando
            ? `${ajustando.nombre}: ${ajustando.stockActual} ${ajustando.unidad} disponibles`
            : undefined
        }
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submitAjuste(event)}
          noValidate
        >
          <Select
            name="operacion"
            label="Operación"
            value={operacion}
            onChange={(event) =>
              setOperacion(event.target.value as OperacionStock)
            }
          >
            <option value="AGREGAR">Agregar existencias</option>
            <option value="DESCONTAR">Descontar existencias</option>
          </Select>
          <Input
            name="cantidad"
            label="Cantidad"
            inputMode="decimal"
            value={cantidad}
            error={ajusteError}
            onChange={(event) => setCantidad(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAjustando(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Aplicar ajuste
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function InventarioSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded bg-bg-surface" />
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
