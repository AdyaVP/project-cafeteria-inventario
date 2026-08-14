'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useAuth } from '@/lib/context/AuthContext'
import { usePreferences } from '@/lib/context/PreferencesContext'
import { Spinner } from '@/components/ui/Spinner'
import { NAV_ITEMS } from '@/lib/constants'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ReadyOrdersStatus } from './ReadyOrdersStatus'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const { usuario, loading } = useAuth()
  const { preferences } = usePreferences()
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

  const itemsVisibles = NAV_ITEMS.filter((item) =>
    item.roles.some((rol) => usuario.roles.includes(rol))
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-bg-base">
      <Sidebar usuario={usuario} />
      <main
        className={clsx(
          'min-w-0 flex-1 overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6',
          preferences.vistaCompacta ? 'p-3 md:p-4' : 'p-4 md:p-6'
        )}
      >
        <ReadyOrdersStatus />
        {children}
      </main>
      <BottomNav navItems={itemsVisibles} />
    </div>
  )
}
