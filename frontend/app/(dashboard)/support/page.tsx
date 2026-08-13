import { HelpCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function SupportPage(): React.JSX.Element {
  return (
    <EmptyState icon={<HelpCircle size={48} />} title="Soporte próximamente" />
  )
}
