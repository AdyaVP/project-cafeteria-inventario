'use client'

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      error,
      id,
      className,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) {
    const generatedId = useId()
    const textareaId = id ?? `${props.name ?? 'textarea'}-${generatedId}`
    const errorId = `${textareaId}-error`
    const describedBy = [ariaDescribedBy, error ? errorId : undefined]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-text-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : ariaInvalid}
          className={clsx(
            'min-h-24 w-full resize-y rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled outline-none transition-colors focus:border-accent',
            error && 'border-state-error',
            className
          )}
          {...props}
        />
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
