import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface DataErrorProps {
  message: string
  onRetry: () => void
}

export function DataError({
  message,
  onRetry,
}: DataErrorProps): React.JSX.Element {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="text-state-error" size={36} />
      <p className="max-w-md text-sm text-state-error">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Intentar de nuevo
      </Button>
    </div>
  )
}
