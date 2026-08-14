'use client'
import { AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DASHBOARD_ROUTE } from '@/lib/constants'
import { Button } from './Button'
interface ModuleErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  title: string
}
export function ModuleError({
  error,
  reset,
  title,
}: ModuleErrorProps): React.JSX.Element {
  const router = useRouter()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-base p-6">
      <AlertTriangle className="text-state-error" size={48} />
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
      <p className="max-w-md text-center text-sm text-text-secondary">
        {error.message}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Intentar de nuevo</Button>
        <Button variant="ghost" onClick={() => router.push(DASHBOARD_ROUTE)}>
          Volver al inicio
        </Button>
      </div>
    </div>
  )
}
