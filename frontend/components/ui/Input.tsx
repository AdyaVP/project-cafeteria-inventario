import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, icon, id, className, ...props },
  ref
) {
  const inputId = id ?? props.name
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
          className={clsx(
            'h-10 w-full rounded-md border border-border-default bg-bg-elevated px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none focus:ring-0 transition-colors',
            icon && 'pl-9',
            error && 'border-state-error',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-state-error">{error}</p>}
    </div>
  )
})
