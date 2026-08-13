'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/context/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !usuario) {
      router.replace('/login')
    }
  }, [usuario, loading, router])

  // Mientras verifica sesión: spinner fullscreen
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <Spinner size="lg" />
      </div>
    )
  }

  // Sin usuario después de verificar: no renderizar nada
  // El useEffect ya redirigió a /login
  if (!usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      <Sidebar usuario={usuario} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
