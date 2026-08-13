'use client'
import { ModuleError } from '@/components/ui/ModuleError'
interface FacturacionErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}
export default function FacturacionError(
  props: FacturacionErrorProps
): React.JSX.Element {
  return <ModuleError {...props} title="Error en el módulo de facturación" />
}
