'use client'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useToast } from '@/lib/context/ToastContext'
import type { ToastType } from '@/lib/types'
const appearances: Record<
  ToastType,
  { border: string; icon: string; Icon: LucideIcon }
> = {
  success: {
    border: 'border-state-success/40',
    icon: 'text-state-success',
    Icon: CheckCircle2,
  },
  error: {
    border: 'border-state-error/40',
    icon: 'text-state-error',
    Icon: XCircle,
  },
  warning: {
    border: 'border-state-warning/40',
    icon: 'text-state-warning',
    Icon: AlertTriangle,
  },
  info: { border: 'border-state-info/40', icon: 'text-state-info', Icon: Info },
}
export function ToastContainer(): React.JSX.Element {
  const { toasts, dismiss } = useToast()
  return (
    <div
      aria-live="polite"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 flex flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6"
    >
      {toasts.map((toast) => {
        const { border, icon, Icon } = appearances[toast.type]
        return (
          <div
            key={toast.id}
            className={clsx(
              'relative w-full translate-x-0 overflow-hidden rounded-lg border bg-bg-overlay p-3 opacity-100 shadow-lg transition-all duration-300 lg:w-[320px]',
              border
            )}
          >
            <div className="flex items-start gap-3">
              <Icon size={20} className={clsx('shrink-0', icon)} />
              <p className="flex-1 text-sm text-text-primary">
                {toast.message}
              </p>
              <button
                type="button"
                aria-label="Cerrar notificación"
                className="min-h-[44px] min-w-[44px] -m-3 flex items-center justify-center text-text-disabled hover:text-text-primary"
                onClick={() => dismiss(toast.id)}
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-accent/30 animate-toast-progress"
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          </div>
        )
      })}
    </div>
  )
}
