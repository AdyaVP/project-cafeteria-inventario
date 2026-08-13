import clsx from 'clsx'
import type { BadgeVariant } from '@/lib/types'
interface BadgeProps {
  variant: BadgeVariant
  label: string
  pulse?: boolean
}
const styles: Record<BadgeVariant, { wrapper: string; dot: string }> = {
  libre: {
    wrapper: 'text-state-success bg-state-success/10',
    dot: 'bg-state-success',
  },
  success: {
    wrapper: 'text-state-success bg-state-success/10',
    dot: 'bg-state-success',
  },
  ocupada: {
    wrapper: 'text-state-error bg-state-error/10',
    dot: 'bg-state-error',
  },
  error: {
    wrapper: 'text-state-error bg-state-error/10',
    dot: 'bg-state-error',
  },
  'cuenta-pedida': {
    wrapper: 'text-state-warning bg-state-warning/10',
    dot: 'bg-state-warning',
  },
  warning: {
    wrapper: 'text-state-warning bg-state-warning/10',
    dot: 'bg-state-warning',
  },
  cerrada: {
    wrapper: 'text-text-disabled bg-bg-elevated',
    dot: 'bg-text-disabled',
  },
  info: { wrapper: 'text-state-info bg-state-info/10', dot: 'bg-state-info' },
}
export function Badge({
  variant,
  label,
  pulse = false,
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        styles[variant].wrapper
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          styles[variant].dot,
          pulse && 'animate-pulse'
        )}
      />
      {label}
    </span>
  )
}
