'use client'

import { ModuleError } from '@/components/ui/ModuleError'

interface FacturaErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function FacturaError(
  props: FacturaErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Error cargando la factura" />
}
