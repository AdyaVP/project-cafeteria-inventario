'use client'
import type { ReactNode } from 'react'
import clsx from 'clsx'
interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  active?: boolean
  hover?: boolean
}
export function Card({
  children,
  className,
  onClick,
  active = false,
  hover = false,
}: CardProps): React.JSX.Element {
  return (
    <div
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') onClick()
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={clsx(
        'rounded-lg border border-border-subtle bg-bg-surface p-4',
        active && 'border-accent ring-1 ring-accent/20',
        (hover || onClick) &&
          'cursor-pointer transition-colors hover:border-border-default',
        className
      )}
    >
      {children}
    </div>
  )
}
