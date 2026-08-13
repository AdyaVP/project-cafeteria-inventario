import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import clsx from 'clsx'

interface TableProps {
  children: ReactNode
  className?: string
}

export function Table({ children, className }: TableProps): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
      <table className={clsx('w-full min-w-max', className)}>{children}</table>
    </div>
  )
}

export function TableHeader({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  return (
    <thead className="border-b border-border-subtle bg-bg-elevated/50">
      {children}
    </thead>
  )
}

export function TableBody({
  children,
}: {
  children: ReactNode
}): React.JSX.Element {
  return <tbody className="divide-y divide-border-subtle/70">{children}</tbody>
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>): React.JSX.Element {
  return (
    <tr
      className={clsx('transition-colors hover:bg-bg-elevated/40', className)}
      {...props}
    />
  )
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-text-secondary',
        className
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <td
      className={clsx('px-4 py-3 text-sm text-text-primary', className)}
      {...props}
    />
  )
}
