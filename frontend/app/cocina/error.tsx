'use client'
import { ModuleError } from '@/components/ui/ModuleError'
interface CocinaErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
export default function CocinaError(
  props: CocinaErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Error en la cola de cocina" />
}
