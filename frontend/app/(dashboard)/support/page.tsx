'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import {
  BookOpenCheck,
  CheckCircle2,
  Clipboard,
  HelpCircle,
  PlugZap,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { getRolDefaultRoute } from '@/lib/constants'
import { authApi } from '@/lib/api/auth'
import { ApiClientError } from '@/lib/api/client'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { restartWebSocket, useWebSocket } from '@/lib/hooks/useWebSocket'
import type { Role, Usuario } from '@/lib/types'

const AUTHENTICATED_ROLES: Role[] = ['ADMIN', 'MESERO', 'CAJERO', 'COCINA']
const SupportSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .max(80, 'La búsqueda no puede superar 80 caracteres'),
})

interface RoleGuide {
  role: Role
  title: string
  description: string
  route: string
  routeLabel: string
  steps: string[]
}

interface Faq {
  id: string
  question: string
  answer: string
  roles?: Role[]
}

interface ApiDiagnostic {
  status: 'idle' | 'checking' | 'online' | 'error'
  latencyMs?: number
  checkedAt?: Date
  message?: string
}

const ROLE_GUIDES: RoleGuide[] = [
  {
    role: 'MESERO',
    title: 'Flujo del mesero',
    description: 'Desde abrir una mesa hasta solicitar la cuenta.',
    route: '/mesas',
    routeLabel: 'Ir a mesas',
    steps: [
      'Selecciona una mesa libre y confirma su apertura.',
      'Agrega alimentos y bebidas; puedes incluir notas por producto.',
      'Envía la orden y espera el aviso de cocina o cafetería.',
      'Entrega cada orden marcada como lista.',
      'Cuando no queden órdenes activas, solicita la cuenta.',
    ],
  },
  {
    role: 'COCINA',
    title: 'Flujo de cocina',
    description: 'Atiende alimentos y bebidas en orden de llegada.',
    route: '/cocina',
    routeLabel: 'Ir a cocina',
    steps: [
      'Revisa el distintivo Comida o Bebida y las notas de cada artículo.',
      'Toma una orden pendiente para marcarla en preparación.',
      'Al terminar todos sus artículos, marca la orden como lista.',
      'La pantalla se sincroniza automáticamente al recibir nuevas órdenes.',
    ],
  },
  {
    role: 'CAJERO',
    title: 'Flujo de caja',
    description: 'Revisa la pre-cuenta y emite la factura.',
    route: '/facturacion',
    routeLabel: 'Ir a facturación',
    steps: [
      'Selecciona una mesa con la cuenta solicitada.',
      'Comprueba artículos, subtotal, impuesto y total de la pre-cuenta.',
      'Elige el método de pago y completa RTN o CAI cuando corresponda.',
      'En efectivo, registra el monto recibido para verificar el cambio.',
      'Emite la factura; la mesa quedará liberada al finalizar.',
    ],
  },
  {
    role: 'ADMIN',
    title: 'Flujo administrativo',
    description: 'Supervisa la operación y mantiene los catálogos.',
    route: '/dashboard',
    routeLabel: 'Ir al panel',
    steps: [
      'Consulta ventas, mesas atendidas y ocupación desde el panel.',
      'Gestiona usuarios y sus roles desde Usuarios.',
      'Mantén productos, disponibilidad y recetas desde Menú.',
      'Registra existencias, ajustes y alertas desde Inventario.',
      'Usa Reportes para consultar el cierre de una fecha.',
    ],
  },
]

const FAQS: Faq[] = [
  {
    id: 'session',
    question: '¿Qué hago si la sesión cambió o dejó de responder?',
    answer:
      'Vuelve a esta pantalla y ejecuta el diagnóstico. Comanda revalida la sesión al recuperar el foco; si ya no es válida, te enviará al acceso automáticamente.',
  },
  {
    id: 'ws',
    question: '¿Por qué una pantalla no se actualiza en tiempo real?',
    answer:
      'Comprueba el estado WebSocket en Diagnóstico. Si aparece desconectado, usa Reconectar para iniciar un enlace nuevo sin cerrar tu sesión.',
  },
  {
    id: 'waiter-ready',
    question: 'No aparece el botón Entregar en una orden',
    answer:
      'El botón aparece cuando cocina o cafetería marca la orden como Lista. Confirma además que la mesa esté asignada a tu sesión.',
    roles: ['MESERO'],
  },
  {
    id: 'waiter-bill',
    question: 'No puedo solicitar la cuenta de una mesa',
    answer:
      'Primero deben estar entregadas todas las órdenes de la mesa. Si existe una orden pendiente, en preparación o lista, termina ese flujo antes de solicitar la cuenta.',
    roles: ['MESERO'],
  },
  {
    id: 'kitchen-order',
    question: '¿En qué orden debo preparar las comandas?',
    answer:
      'La cola muestra primero las órdenes más antiguas. Revisa siempre el tipo Comida o Bebida y las notas antes de cambiar el estado.',
    roles: ['COCINA'],
  },
  {
    id: 'cash-register',
    question: 'Una mesa no aparece para facturar',
    answer:
      'Caja muestra mesas en Cuenta pedida. El mesero debe entregar todas las órdenes y solicitar la cuenta antes de que aparezca en facturación.',
    roles: ['CAJERO'],
  },
  {
    id: 'cash-rtn',
    question: '¿Qué formato debe tener el RTN?',
    answer:
      'Cuando se registra, el RTN debe contener exactamente 14 dígitos. Revisa también el método de pago y el CAI antes de emitir.',
    roles: ['CAJERO'],
  },
  {
    id: 'admin-food',
    question: '¿Por qué una comida nueva no queda disponible?',
    answer:
      'Los productos de comida necesitan una receta válida antes de activarse. Crea la receta con artículos de inventario y luego habilita su disponibilidad.',
    roles: ['ADMIN'],
  },
  {
    id: 'admin-stock',
    question: '¿Cómo se corrige una existencia sin editarla directamente?',
    answer:
      'Usa Ajustar stock en Inventario y elige Agregar o Descontar. Verifica la cantidad y la unidad mostradas antes de confirmar.',
    roles: ['ADMIN'],
  },
]

export default function SupportPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(AUTHENTICATED_ROLES)

  if (loading || !autorizado) return null

  return <SupportContent />
}

function SupportContent(): React.JSX.Element {
  const { usuario } = useAuth()
  const { connected } = useWebSocket()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [networkOnline, setNetworkOnline] = useState(true)
  const [apiDiagnostic, setApiDiagnostic] = useState<ApiDiagnostic>({
    status: 'idle',
  })
  const diagnosticSequenceRef = useRef(0)
  const activeControllerRef = useRef<AbortController | null>(null)

  const runApiDiagnostic = useCallback(async (): Promise<void> => {
    const sequence = diagnosticSequenceRef.current + 1
    diagnosticSequenceRef.current = sequence
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller
    const startedAt = performance.now()
    setApiDiagnostic({ status: 'checking' })

    try {
      const sessionUser = await authApi.getMe({ signal: controller.signal })
      if (
        controller.signal.aborted ||
        diagnosticSequenceRef.current !== sequence
      ) {
        return
      }
      if (!usuario || !sameSession(usuario, sessionUser)) {
        setApiDiagnostic({
          status: 'error',
          checkedAt: new Date(),
          message:
            'La identidad de la sesión cambió. Recarga el área de trabajo.',
        })
        return
      }

      setApiDiagnostic({
        status: 'online',
        latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
        checkedAt: new Date(),
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      if (diagnosticSequenceRef.current !== sequence) return

      const message =
        error instanceof ApiClientError
          ? `API ${error.statusCode}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'No fue posible contactar la API'
      setApiDiagnostic({
        status: 'error',
        checkedAt: new Date(),
        message,
      })
    } finally {
      if (diagnosticSequenceRef.current === sequence) {
        activeControllerRef.current = null
      }
    }
  }, [usuario])

  useEffect(() => {
    const syncNetworkStatus = (): void => setNetworkOnline(navigator.onLine)
    const checkApi = (): void => {
      syncNetworkStatus()
      void runApiDiagnostic()
    }

    syncNetworkStatus()
    void runApiDiagnostic()
    window.addEventListener('online', checkApi)
    window.addEventListener('offline', syncNetworkStatus)
    window.addEventListener('focus', checkApi)

    return () => {
      window.removeEventListener('online', checkApi)
      window.removeEventListener('offline', syncNetworkStatus)
      window.removeEventListener('focus', checkApi)
      diagnosticSequenceRef.current += 1
      activeControllerRef.current?.abort()
    }
  }, [runApiDiagnostic])

  const guides = useMemo(
    () =>
      ROLE_GUIDES.filter(
        (guide) => usuario?.roles.includes(guide.role) ?? false
      ),
    [usuario]
  )
  const availableFaqs = useMemo(
    () =>
      FAQS.filter(
        (faq) =>
          !faq.roles ||
          faq.roles.some((role) => usuario?.roles.includes(role) ?? false)
      ),
    [usuario]
  )
  const normalizedQuery = activeQuery.toLocaleLowerCase('es-HN')
  const filteredGuides = guides.filter((guide) =>
    [guide.title, guide.description, ...guide.steps]
      .join(' ')
      .toLocaleLowerCase('es-HN')
      .includes(normalizedQuery)
  )
  const filteredFaqs = availableFaqs.filter((faq) =>
    `${faq.question} ${faq.answer}`
      .toLocaleLowerCase('es-HN')
      .includes(normalizedQuery)
  )

  const handleSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const result = SupportSearchSchema.safeParse({ query })
    if (!result.success) {
      setSearchError(result.error.flatten().fieldErrors.query?.[0] ?? null)
      return
    }
    setSearchError(null)
    setActiveQuery(result.data.query)
  }

  const clearSearch = (): void => {
    setQuery('')
    setActiveQuery('')
    setSearchError(null)
  }

  const reconnect = (): void => {
    restartWebSocket()
    toast.info('Reconexión WebSocket solicitada')
  }

  const copyDiagnostic = async (): Promise<void> => {
    const lines = [
      'Diagnóstico Comanda',
      `Fecha: ${new Date().toISOString()}`,
      `Ruta: ${window.location.pathname}`,
      `Usuario: ${usuario?.email ?? 'sin sesión'}`,
      `Roles: ${usuario?.roles.join(', ') ?? 'ninguno'}`,
      `Navegador en línea: ${networkOnline ? 'sí' : 'no'}`,
      `API /auth/me: ${diagnosticStatusLabel(apiDiagnostic)}`,
      `WebSocket: ${connected ? 'conectado' : 'desconectado/reconectando'}`,
      `Navegador: ${navigator.userAgent}`,
    ]

    try {
      await writeClipboard(lines.join('\n'))
      toast.success('Diagnóstico copiado')
    } catch {
      toast.error('No fue posible copiar el diagnóstico')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Ayuda y soporte</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Guías para tu rol y diagnóstico del dispositivo actual.
          </p>
        </div>
        {usuario && (
          <Link
            href={getRolDefaultRoute(usuario.roles)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3 text-sm text-accent transition-colors hover:bg-accent/10"
          >
            Volver al área de trabajo
          </Link>
        )}
      </header>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
        onSubmit={handleSearch}
        noValidate
      >
        <div className="min-w-0 flex-1">
          <Input
            name="support-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchError(null)
            }}
            error={searchError ?? undefined}
            icon={<Search aria-hidden="true" size={16} />}
            placeholder="Buscar por mesa, orden, factura, inventario…"
            aria-label="Buscar en ayuda"
          />
        </div>
        <Button type="submit" icon={<Search size={16} />}>
          Buscar
        </Button>
        {(activeQuery || query) && (
          <Button variant="ghost" onClick={clearSearch}>
            Limpiar
          </Button>
        )}
      </form>

      <section aria-labelledby="diagnostic-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="diagnostic-title" className="font-semibold">
              Diagnóstico en vivo
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              No incluye contraseñas, cookies ni tokens.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={apiDiagnostic.status === 'checking'}
              icon={<RefreshCw size={16} />}
              onClick={() => void runApiDiagnostic()}
            >
              Verificar API
            </Button>
            <Button
              variant="secondary"
              icon={<PlugZap size={16} />}
              onClick={reconnect}
            >
              Reconectar
            </Button>
            <Button
              variant="ghost"
              icon={<Clipboard size={16} />}
              onClick={() => void copyDiagnostic()}
            >
              Copiar diagnóstico
            </Button>
          </div>
        </div>

        <div className="comanda-density-grid grid gap-3 md:grid-cols-3">
          <DiagnosticCard
            title="Navegador"
            description={
              networkOnline
                ? 'El dispositivo reporta acceso a la red.'
                : 'El dispositivo está sin conexión a la red.'
            }
            healthy={networkOnline}
            pending={false}
            icon={networkOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
          />
          <DiagnosticCard
            title="API y sesión"
            description={diagnosticStatusLabel(apiDiagnostic)}
            healthy={apiDiagnostic.status === 'online'}
            pending={
              apiDiagnostic.status === 'checking' ||
              apiDiagnostic.status === 'idle'
            }
            icon={<CheckCircle2 size={20} />}
          />
          <DiagnosticCard
            title="Tiempo real"
            description={
              connected
                ? 'WebSocket conectado y recibiendo eventos.'
                : 'Desconectado; usa Reconectar para iniciar un enlace nuevo.'
            }
            healthy={connected}
            pending={!connected && networkOnline}
            icon={<PlugZap size={20} />}
          />
        </div>
      </section>

      {(filteredGuides.length > 0 || filteredFaqs.length > 0) && (
        <>
          {filteredGuides.length > 0 && (
            <section aria-labelledby="guide-title">
              <div className="mb-3 flex items-center gap-2">
                <BookOpenCheck className="text-accent" size={20} />
                <h2 id="guide-title" className="font-semibold">
                  Guía operativa para tu rol
                </h2>
              </div>
              <div className="comanda-density-grid grid gap-4 xl:grid-cols-2">
                {filteredGuides.map((guide) => (
                  <RoleGuideCard key={guide.role} guide={guide} />
                ))}
              </div>
            </section>
          )}

          {filteredFaqs.length > 0 && (
            <section aria-labelledby="faq-title">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="text-accent" size={20} />
                <h2 id="faq-title" className="font-semibold">
                  Preguntas frecuentes
                </h2>
              </div>
              <div className="space-y-3">
                {filteredFaqs.map((faq) => (
                  <Card key={faq.id}>
                    <h3 className="text-sm font-semibold">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {faq.answer}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {filteredGuides.length === 0 && filteredFaqs.length === 0 && (
        <Card>
          <EmptyState
            icon={<Search size={40} />}
            title="Sin resultados"
            description="Prueba con mesa, orden, cocina, factura o inventario."
          />
          <div className="flex justify-center">
            <Button variant="secondary" onClick={clearSearch}>
              Ver toda la ayuda
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

interface DiagnosticCardProps {
  title: string
  description: string
  healthy: boolean
  pending: boolean
  icon: React.ReactNode
}

function DiagnosticCard({
  title,
  description,
  healthy,
  pending,
  icon,
}: DiagnosticCardProps): React.JSX.Element {
  const variant = pending ? 'warning' : healthy ? 'success' : 'error'
  const label = pending ? 'Verificando' : healthy ? 'Operativo' : 'Con problema'

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={
            pending
              ? 'text-state-warning'
              : healthy
                ? 'text-state-success'
                : 'text-state-error'
          }
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <Badge variant={variant} label={label} pulse={pending} />
          </div>
          <p className="mt-2 break-words text-xs leading-relaxed text-text-secondary">
            {description}
          </p>
        </div>
      </div>
    </Card>
  )
}

function RoleGuideCard({ guide }: { guide: RoleGuide }): React.JSX.Element {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{guide.title}</h3>
          <p className="mt-1 text-xs text-text-secondary">
            {guide.description}
          </p>
        </div>
        <Badge variant="info" label={guide.role} />
      </div>
      <ol className="my-4 flex-1 space-y-3">
        {guide.steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-[11px] font-bold text-accent">
              {index + 1}
            </span>
            <span className="pt-0.5 leading-relaxed text-text-secondary">
              {step}
            </span>
          </li>
        ))}
      </ol>
      <Link
        href={guide.route}
        className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border-default bg-bg-elevated px-4 text-sm font-medium text-text-primary transition-colors hover:bg-bg-overlay"
      >
        {guide.routeLabel}
      </Link>
    </Card>
  )
}

function diagnosticStatusLabel(diagnostic: ApiDiagnostic): string {
  if (diagnostic.status === 'checking') return 'Verificando /auth/me…'
  if (diagnostic.status === 'idle') return 'Esperando verificación.'
  if (diagnostic.status === 'error') {
    return diagnostic.message ?? 'La API no respondió correctamente.'
  }

  const time = diagnostic.checkedAt
    ? new Intl.DateTimeFormat('es-HN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(diagnostic.checkedAt)
    : 'ahora'
  return `Sesión válida · ${diagnostic.latencyMs ?? 0} ms · ${time}`
}

function sameSession(current: Usuario, checked: Usuario): boolean {
  return (
    current.id === checked.id &&
    current.activo === checked.activo &&
    current.roles.length === checked.roles.length &&
    current.roles.every((role) => checked.roles.includes(role))
  )
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard no disponible')
}
