import type { ReactNode } from 'react'
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
}
export function EmptyState({
  icon,
  title,
  description,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-44 flex-col items-center justify-center text-center">
      {icon && <div className="mb-3 text-text-disabled">{icon}</div>}
      <p className="font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-text-disabled">{description}</p>
      )}
    </div>
  )
}
