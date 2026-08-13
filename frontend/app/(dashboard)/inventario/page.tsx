'use client'

import { Package } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRolGuard } from '@/lib/hooks/useRolGuard'

export default function InventarioPage(): React.JSX.Element | null {
  const { autorizado, loading } = useRolGuard(['ADMIN'])

  if (loading || !autorizado) return null

  return (
    <EmptyState
      icon={<Package size={48} />}
      title="Módulo de Inventario"
      description="Esta vista está siendo desarrollada"
    />
  )
}
