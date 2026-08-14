'use client'

import { ModuleError } from '@/components/ui/ModuleError'

interface OrdenesErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
export default function OrdenesError(
  props: OrdenesErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Error cargando las órdenes" />
}
