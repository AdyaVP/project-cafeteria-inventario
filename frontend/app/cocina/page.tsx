'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChefHat, Clock, Flame, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { DataError } from '@/components/ui/DataError'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderCard } from '@/components/ui/OrderCard'
import { useAuth } from '@/lib/context/AuthContext'
import { useToast } from '@/lib/context/ToastContext'
import { useCola } from '@/lib/hooks/useCola'
import { useRolGuard } from '@/lib/hooks/useRolGuard'
import { useClock } from '@/lib/hooks/useTimer'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import type { Orden } from '@/lib/types'

export default function CocinaPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN', 'COCINA'])

  if (loading || !autorizado) return null

  return <CocinaContent />
}

function CocinaContent(): React.JSX.Element {
  const { socket, connected } = useWebSocket()
  const {
    pendientes,
    enPreparacion,
    listas,
    loading,
    error,
    marcarEnPreparacion,
    marcarLista,
    refetch,
  } = useCola(socket)
  const clockTime = useClock()
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  useEffect(() => {
    if (error) toast.error(error)
  }, [error, toast])
  const start = async (id: string): Promise<void> => {
    try {
      await marcarEnPreparacion(id)
      toast.success('Orden en preparación')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Error al actualizar la orden'
      )
    }
  }
  const ready = async (id: string): Promise<void> => {
    try {
      await marcarLista(id)
      toast.success('Orden lista para entregar')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Error al actualizar la orden'
      )
    }
  }
  const signOut = async (): Promise<void> => {
    try {
      await logout()
      router.push('/login')
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Error al cerrar sesión'
      )
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-4 md:px-6">
        <div className="flex items-center gap-3">
          <ChefHat size={20} className="text-accent" />
          <span className="hidden text-[10px] uppercase tracking-widest text-text-secondary sm:inline">
            Cocina
          </span>
          <span className="text-lg font-bold">Comanda</span>
        </div>
        <span className="rounded-full border border-accent bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
          {pendientes.length + enPreparacion.length} órdenes activas
        </span>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="hidden font-mono text-lg text-text-primary sm:inline">
            {clockTime}
          </span>
          <span
            aria-label={connected ? 'Conectado' : 'Desconectado'}
            className={clsx(
              'h-2 w-2 rounded-full',
              connected ? 'animate-pulse bg-state-success' : 'bg-state-error'
            )}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut size={16} />}
            onClick={() => void signOut()}
          >
            Salir
          </Button>
        </div>
      </header>
      {loading ? (
        <CocinaSkeleton />
      ) : error ? (
        <DataError message={error} onRetry={() => void refetch()} />
      ) : (
        <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-3">
          <KanbanColumn
            title="Pendiente"
            icon={<Clock size={16} className="text-state-warning" />}
            ordenes={pendientes}
            actionLabel="INICIAR PREPARACIÓN"
            actionVariant="secondary"
            onAction={start}
            counterColor="bg-state-warning/10 text-state-warning"
          />
          <KanbanColumn
            title="En Preparación"
            icon={<Flame size={16} className="text-state-error" />}
            ordenes={enPreparacion}
            actionLabel="MARCAR LISTA"
            actionVariant="primary"
            onAction={ready}
            counterColor="bg-state-error/10 text-state-error"
          />
          <KanbanColumn
            title="Lista"
            icon={<CheckCircle2 size={16} className="text-state-success" />}
            ordenes={listas}
            counterColor="bg-state-success/10 text-state-success"
          />
        </main>
      )}
    </div>
  )
}

interface KanbanColumnProps {
  title: string
  icon: ReactNode
  ordenes: Orden[]
  actionLabel?: string
  actionVariant?: 'primary' | 'secondary' | 'ghost'
  onAction?: (id: string) => Promise<void>
  counterColor: string
}
function KanbanColumn({
  title,
  icon,
  ordenes,
  actionLabel,
  actionVariant,
  onAction,
  counterColor,
}: KanbanColumnProps): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[11px] uppercase tracking-widest text-text-secondary">
            {title}
          </h2>
        </div>
        <span
          className={clsx(
            'rounded px-2 py-0.5 text-xs font-semibold',
            counterColor
          )}
        >
          {ordenes.length}
        </span>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {ordenes.length > 0 ? (
          ordenes.map((orden) => (
            <OrderCard
              key={orden.id}
              orden={orden}
              actionLabel={actionLabel}
              actionVariant={actionVariant}
              onAction={onAction ? (id) => void onAction(id) : undefined}
            />
          ))
        ) : (
          <EmptyState title={`Sin órdenes en ${title.toLowerCase()}`} />
        )}
      </div>
    </section>
  )
}

function CocinaSkeleton(): React.JSX.Element {
  return (
    <main className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, column) => (
        <section key={column}>
          <div className="mb-3 h-5 w-32 animate-pulse rounded bg-bg-surface" />
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, card) => (
              <div
                key={card}
                className="h-48 animate-pulse rounded-lg bg-bg-surface"
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
