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
  const classes = clsx(
    'rounded-lg border border-border-subtle bg-bg-surface p-4',
    active && 'border-accent ring-1 ring-accent/20',
    (hover || onClick) &&
      'cursor-pointer transition-colors hover:border-border-default',
    onClick && 'block min-h-[44px] w-full text-left',
    className
  )

  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={classes}
      >
        {children}
      </button>
    )
  }

  return <div className={classes}>{children}</div>
}
