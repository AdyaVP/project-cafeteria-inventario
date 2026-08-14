'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, UserMinus, Users } from 'lucide-react'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { useUsuarios } from '@/lib/hooks/useUsuarios'
import type { Role, Usuario } from '@/lib/types'

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MESERO', label: 'Mesero' },
  { value: 'CAJERO', label: 'Cajero' },
  { value: 'COCINA', label: 'Cocina' },
]

const UsuarioFormSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa al menos 2 caracteres').max(100),
  email: z.string().trim().email('Ingresa un correo válido').toLowerCase(),
  password: z
    .string()
    .min(8, 'Usa al menos 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Incluye mayúscula, minúscula y número'
    ),
  roles: z
    .array(z.enum(['ADMIN', 'MESERO', 'CAJERO', 'COCINA']))
    .min(1, 'Elige al menos un rol'),
})

const RolesFormSchema = z.object({
  roles: z
    .array(z.enum(['ADMIN', 'MESERO', 'CAJERO', 'COCINA']))
    .min(1, 'Elige al menos un rol'),
})

interface UsuarioFormErrors {
  nombre?: string
  email?: string
  password?: string
  roles?: string
}

const EMPTY_FORM = {
  nombre: '',
  email: '',
  password: '',
  roles: ['MESERO'] as Role[],
}

export default function UsuariosPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN'])
  if (loading || !autorizado) return null
  return <UsuariosContent />
}

function UsuariosContent(): React.JSX.Element {
  const { usuario: sesion } = useAuth()
  const {
    usuarios,
    loading,
    saving,
    error,
    refetch,
    crear,
    actualizarRoles,
    desactivar,
  } = useUsuarios()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [desactivando, setDesactivando] = useState<Usuario | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<UsuarioFormErrors>({})
  const [rolesEditados, setRolesEditados] = useState<Role[]>([])
  const [rolesError, setRolesError] = useState<string>()

  const filtrados = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')
    if (!query) return usuarios
    return usuarios.filter(
      (item) =>
        item.nombre.toLocaleLowerCase('es').includes(query) ||
        item.email.toLocaleLowerCase('es').includes(query) ||
        item.roles.some((role) => role.toLocaleLowerCase('es').includes(query))
    )
  }, [search, usuarios])

  const toggleRole = (
    role: Role,
    selected: Role[],
    update: (roles: Role[]) => void
  ): void => {
    update(
      selected.includes(role)
        ? selected.filter((current) => current !== role)
        : [...selected, role]
    )
  }

  const submitCrear = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    const result = UsuarioFormSchema.safeParse(form)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      setFormErrors({
        nombre: fields.nombre?.[0],
        email: fields.email?.[0],
        password: fields.password?.[0],
        roles: fields.roles?.[0],
      })
      return
    }
    setFormErrors({})
    try {
      await crear(result.data)
      toast.success('Usuario creado correctamente')
      setForm(EMPTY_FORM)
      setCreateOpen(false)
    } catch (createError: unknown) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : 'No fue posible crear el usuario'
      )
    }
  }

  const abrirRoles = (item: Usuario): void => {
    setRolesEditados(item.roles)
    setRolesError(undefined)
    setEditando(item)
  }

  const submitRoles = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    if (!editando) return
    const result = RolesFormSchema.safeParse({ roles: rolesEditados })
    if (!result.success) {
      setRolesError(result.error.flatten().fieldErrors.roles?.[0])
      return
    }
    setRolesError(undefined)
    try {
      await actualizarRoles(editando.id, result.data)
      toast.success('Roles actualizados correctamente')
      setEditando(null)
    } catch (updateError: unknown) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : 'No fue posible actualizar los roles'
      )
    }
  }

  const confirmarDesactivacion = async (): Promise<void> => {
    if (!desactivando) return
    try {
      await desactivar(desactivando.id)
      toast.success(`${desactivando.nombre} fue desactivado`)
      setDesactivando(null)
    } catch (deactivateError: unknown) {
      toast.error(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'No fue posible desactivar el usuario'
      )
    }
  }

  if (loading && usuarios.length === 0) return <UsuariosSkeleton />
  if (error && usuarios.length === 0) {
    return <DataError message={error} onRetry={() => void refetch()} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Gestión de usuarios</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Crea cuentas, asigna roles y desactiva accesos sin borrar historial.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          Nuevo usuario
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Usuarios activos
          </p>
          <p className="mt-2 text-3xl font-bold">{usuarios.length}</p>
        </Card>
        <Card>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">
            Administradores
          </p>
          <p className="mt-2 text-3xl font-bold">
            {usuarios.filter((item) => item.roles.includes('ADMIN')).length}
          </p>
        </Card>
      </div>

      <div className="max-w-md">
        <Input
          label="Buscar usuario"
          value={search}
          icon={<Search size={15} />}
          placeholder="Nombre, correo o rol"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={42} />}
            title={
              usuarios.length === 0
                ? 'No hay usuarios activos'
                : 'Sin coincidencias'
            }
          />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((item) => {
              const esSesionActual = item.id === sesion?.id
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {item.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.roles.map((role) => (
                        <Badge key={role} variant="info" label={role} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" label="Activo" />
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {item.createdAt
                      ? new Intl.DateTimeFormat('es-HN').format(
                          new Date(item.createdAt)
                        )
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Pencil size={14} />}
                        disabled={saving || esSesionActual}
                        title={
                          esSesionActual
                            ? 'No puedes cambiar los roles de tu propia sesión'
                            : undefined
                        }
                        onClick={() => abrirRoles(item)}
                      >
                        Roles
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<UserMinus size={14} />}
                        disabled={saving || esSesionActual}
                        title={
                          esSesionActual
                            ? 'No puedes desactivar tu propia sesión'
                            : undefined
                        }
                        onClick={() => setDesactivando(item)}
                      >
                        Desactivar
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
        title="Crear usuario"
        description="La contraseña debe incluir mayúscula, minúscula y número."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submitCrear(event)}
          noValidate
        >
          <Input
            name="nombre"
            label="Nombre"
            value={form.nombre}
            error={formErrors.nombre}
            onChange={(event) =>
              setForm((current) => ({ ...current, nombre: event.target.value }))
            }
          />
          <Input
            name="email"
            type="email"
            label="Correo electrónico"
            value={form.email}
            error={formErrors.email}
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <Input
            name="password"
            type="password"
            label="Contraseña temporal"
            value={form.password}
            error={formErrors.password}
            autoComplete="new-password"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
          <RoleSelector
            selected={form.roles}
            error={formErrors.roles}
            onToggle={(role) =>
              toggleRole(role, form.roles, (roles) =>
                setForm((current) => ({ ...current, roles }))
              )
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
              Crear usuario
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title="Actualizar roles"
        size="sm"
      >
        <form
          className="space-y-5"
          onSubmit={(event) => void submitRoles(event)}
          noValidate
        >
          <p className="text-sm text-text-secondary">
            Roles para{' '}
            <span className="font-semibold text-text-primary">
              {editando?.nombre}
            </span>
          </p>
          <RoleSelector
            selected={rolesEditados}
            error={rolesError}
            onToggle={(role) =>
              toggleRole(role, rolesEditados, setRolesEditados)
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
              Guardar roles
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!desactivando}
        onClose={() => setDesactivando(null)}
        title="Desactivar usuario"
        size="sm"
      >
        <p className="text-sm text-text-secondary">
          {desactivando?.nombre} perderá acceso inmediatamente. Sus datos
          históricos se conservarán.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDesactivando(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={saving}
            onClick={() => void confirmarDesactivacion()}
          >
            Confirmar desactivación
          </Button>
        </div>
      </Modal>
    </div>
  )
}

interface RoleSelectorProps {
  selected: Role[]
  error?: string
  onToggle: (role: Role) => void
}

function RoleSelector({
  selected,
  error,
  onToggle,
}: RoleSelectorProps): React.JSX.Element {
  return (
    <fieldset>
      <legend className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
        Roles
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => (
          <label
            key={role.value}
            className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border-default bg-bg-elevated px-3 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(role.value)}
              onChange={() => onToggle(role.value)}
              className="accent-accent"
            />
            {role.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-[11px] text-state-error">{error}</p>}
    </fieldset>
  )
}

function UsuariosSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded bg-bg-surface" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded bg-bg-surface" />
        <div className="h-24 animate-pulse rounded bg-bg-surface" />
      </div>
      <div className="h-72 animate-pulse rounded bg-bg-surface" />
    </div>
  )
}
