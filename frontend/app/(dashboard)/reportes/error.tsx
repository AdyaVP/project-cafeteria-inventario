'use client'

import { ModuleError } from '@/components/ui/ModuleError'

interface ReportesErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ReportesError(
  props: ReportesErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Error cargando los reportes" />
}
