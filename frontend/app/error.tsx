'use client'
import { ModuleError } from '@/components/ui/ModuleError'
interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
export default function GlobalError(
  props: GlobalErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Algo salió mal" />
}
