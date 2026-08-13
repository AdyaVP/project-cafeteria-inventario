'use client'
import { ModuleError } from '@/components/ui/ModuleError'
interface MesasErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
export default function MesasError(props: MesasErrorProps): React.JSX.Element {
  return <ModuleError {...props} title="Error cargando las mesas" />
}
