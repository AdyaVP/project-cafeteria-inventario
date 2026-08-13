'use client'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { Spinner } from './Spinner'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
}
const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white font-semibold',
  secondary:
    'border border-border-default bg-bg-elevated hover:bg-bg-overlay text-text-primary',
  ghost: 'hover:bg-bg-elevated text-text-secondary hover:text-text-primary',
  danger:
    'bg-state-error/10 border border-state-error text-state-error hover:bg-state-error hover:text-white',
}
const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex min-w-[44px] items-center justify-center gap-2 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          loading && 'pointer-events-none opacity-70',
          className
        )}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : icon}
        {children}
      </button>
    )
  }
)
