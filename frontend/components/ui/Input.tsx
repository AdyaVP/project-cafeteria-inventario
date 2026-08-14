'use client'

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    icon,
    id,
    className,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? `${props.name ?? 'input'}-${generatedId}`
  const errorId = `${inputId}-error`
  const describedBy = [ariaDescribedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-secondary"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : ariaInvalid}
          className={clsx(
            'min-h-[44px] w-full rounded-md border border-border-default bg-bg-elevated px-3 text-sm text-text-primary placeholder:text-text-disabled transition-colors focus:border-accent focus:outline-none focus:ring-0',
            icon && 'pl-9',
            error && 'border-state-error',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-[11px] text-state-error"
        >
          {error}
        </p>
      )}
    </div>
  )
})
