import { Settings } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function SettingsPage(): React.JSX.Element {
  return (
    <EmptyState
      icon={<Settings size={48} />}
      title="Configuración próximamente"
    />
  )
}
