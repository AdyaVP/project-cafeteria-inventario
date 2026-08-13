'use client'

import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      error,
      id,
      className,
      children,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) {
    const generatedId = useId()
    const selectId = id ?? `${props.name ?? 'select'}-${generatedId}`
    const errorId = `${selectId}-error`
    const describedBy = [ariaDescribedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : ariaInvalid}
          className={clsx(
            'min-h-[44px] w-full rounded-md border border-border-default bg-bg-elevated px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent',
            error && 'border-state-error',
            className
          )}
          {...props}
        >
          {children}
        </select>
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
  }
)
