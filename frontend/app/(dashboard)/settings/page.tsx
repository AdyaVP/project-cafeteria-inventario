'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Accessibility,
  BellRing,
  LayoutPanelTop,
  LogOut,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRound,
  Volume2,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { getRolDefaultRoute } from '@/lib/constants'
import { useAuth } from '@/lib/context/AuthContext'
import {
  DEFAULT_PREFERENCES,
  PreferencesSchema,
  usePreferences,
  type Preferences,
} from '@/lib/context/PreferencesContext'
import { useToast } from '@/lib/context/ToastContext'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import type { Role } from '@/lib/types'

const AUTHENTICATED_ROLES: Role[] = ['ADMIN', 'MESERO', 'CAJERO', 'COCINA']
const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  MESERO: 'Mesero',
  CAJERO: 'Cajero',
  COCINA: 'Cocina',
}

export default function SettingsPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(AUTHENTICATED_ROLES)

  if (loading || !autorizado) return null

  return <SettingsContent />
}

function SettingsContent(): React.JSX.Element {
  const { usuario, logout } = useAuth()
  const {
    preferences,
    hydrated,
    savePreferences,
    resetPreferences,
    playAlertSound,
  } = usePreferences()
  const { toast } = useToast()
  const router = useRouter()
  const [form, setForm] = useState<Preferences>(preferences)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (hydrated) setForm(preferences)
  }, [hydrated, preferences])

  const updatePreference = (key: keyof Preferences, value: boolean): void => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
    setFormError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const result = PreferencesSchema.safeParse(form)
    if (!result.success) {
      setFormError('Revisa las preferencias seleccionadas.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      savePreferences(result.data)
      setSaved(true)
      toast.success('Preferencias guardadas')
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible guardar las preferencias'
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = (): void => {
    try {
      resetPreferences()
      setForm(DEFAULT_PREFERENCES)
      setSaved(true)
      setFormError(null)
      toast.success('Preferencias restauradas')
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible restaurar las preferencias'
      setFormError(message)
      toast.error(message)
    }
  }

  const handleSoundTest = async (): Promise<void> => {
    if (!form.sonidoAlertas) {
      toast.info('Activa el sonido y guarda la preferencia para probarlo')
      return
    }

    const played = await playAlertSound(true)
    if (played) toast.success('Sonido de alerta listo')
    else toast.warning('El navegador bloqueó el sonido; vuelve a intentarlo')
  }

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true)
    try {
      await logout()
      router.replace('/login')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible cerrar la sesión'
      )
      setLoggingOut(false)
    }
  }

  if (!hydrated || !usuario) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const hasChanges =
    form.sonidoAlertas !== preferences.sonidoAlertas ||
    form.vistaCompacta !== preferences.vistaCompacta ||
    form.reducirMovimiento !== preferences.reducirMovimiento

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Configuración</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Ajusta la experiencia de este dispositivo y consulta tu sesión.
        </p>
      </header>

      <div className="comanda-density-grid grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card>
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-md bg-accent/10 p-2 text-accent">
              <LayoutPanelTop aria-hidden="true" size={20} />
            </div>
            <div>
              <h2 className="font-semibold">Preferencias del dispositivo</h2>
              <p className="mt-1 text-xs text-text-secondary">
                Se guardan solo en este navegador y no modifican tu cuenta.
              </p>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            <PreferenceToggle
              id="sonido-alertas"
              checked={form.sonidoAlertas}
              disabled={saving}
              icon={<BellRing aria-hidden="true" size={18} />}
              title="Sonido de alertas"
              description="Emite un aviso cuando una orden del mesero queda lista."
              onChange={(checked) => updatePreference('sonidoAlertas', checked)}
            />
            <PreferenceToggle
              id="vista-compacta"
              checked={form.vistaCompacta}
              disabled={saving}
              icon={<LayoutPanelTop aria-hidden="true" size={18} />}
              title="Vista compacta"
              description="Reduce el espacio exterior para mostrar más información operativa."
              onChange={(checked) => updatePreference('vistaCompacta', checked)}
            />
            <PreferenceToggle
              id="reducir-movimiento"
              checked={form.reducirMovimiento}
              disabled={saving}
              icon={<Accessibility aria-hidden="true" size={18} />}
              title="Reducir movimiento"
              description="Minimiza animaciones y transiciones en toda la aplicación."
              onChange={(checked) =>
                updatePreference('reducirMovimiento', checked)
              }
            />

            {formError && (
              <p role="alert" className="text-sm text-state-error">
                {formError}
              </p>
            )}
            {saved && !hasChanges && !formError && (
              <p role="status" className="text-sm text-state-success">
                Las preferencias de este dispositivo están guardadas.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
              <Button
                type="submit"
                loading={saving}
                disabled={!hasChanges}
                icon={<Save size={16} />}
              >
                Guardar cambios
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleSoundTest()}
                icon={<Volume2 size={16} />}
              >
                Probar sonido
              </Button>
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={saving}
                icon={<RotateCcw size={16} />}
              >
                Restaurar
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md bg-state-info/10 p-2 text-state-info">
                <UserRound aria-hidden="true" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Sesión actual</h2>
                <p className="text-xs text-text-secondary">
                  Identidad verificada por el servidor
                </p>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <SessionRow label="Nombre" value={usuario.nombre} />
              <SessionRow label="Correo" value={usuario.email} />
              <div className="border-t border-border-subtle pt-3">
                <dt className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                  Roles
                </dt>
                <dd className="flex flex-wrap gap-2">
                  {usuario.roles.map((role) => (
                    <Badge
                      key={role}
                      variant="info"
                      label={ROLE_LABELS[role]}
                    />
                  ))}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                <dt className="text-text-secondary">Estado</dt>
                <dd>
                  <Badge
                    variant={usuario.activo ? 'success' : 'error'}
                    label={usuario.activo ? 'Activo' : 'Inactivo'}
                  />
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="shrink-0 text-state-success"
                size={20}
              />
              <div>
                <h2 className="text-sm font-semibold">Sesión protegida</h2>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  Comanda valida tu sesión con el servidor. El navegador no
                  muestra ni manipula tus credenciales de acceso.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              fullWidth
              className="mt-4"
              loading={loggingOut}
              icon={<LogOut size={16} />}
              onClick={() => void handleLogout()}
            >
              Cerrar sesión
            </Button>
          </Card>

          <Button
            variant="ghost"
            fullWidth
            onClick={() => router.push(getRolDefaultRoute(usuario.roles))}
          >
            Volver al área de trabajo
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PreferenceToggleProps {
  id: string
  checked: boolean
  disabled: boolean
  icon: React.ReactNode
  title: string
  description: string
  onChange: (checked: boolean) => void
}

function PreferenceToggle({
  id,
  checked,
  disabled,
  icon,
  title,
  description,
  onChange,
}: PreferenceToggleProps): React.JSX.Element {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[68px] cursor-pointer items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated p-3 transition-colors hover:border-border-default"
    >
      <span className="shrink-0 text-text-secondary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-accent"
      />
    </label>
  )
}

interface SessionRowProps {
  label: string
  value: string
}

function SessionRow({ label, value }: SessionRowProps): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border-subtle pt-3 first:border-0 first:pt-0">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  )
}
