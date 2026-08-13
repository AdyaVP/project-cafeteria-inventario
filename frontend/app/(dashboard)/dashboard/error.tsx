'use client'
import { ModuleError } from '@/components/ui/ModuleError'
interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
export default function DashboardError(
  props: DashboardErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Error cargando los reportes" />
}
