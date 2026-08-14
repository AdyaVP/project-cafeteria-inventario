'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/context/AuthContext'
import { getRolDefaultRoute } from '@/lib/constants'
import type { Role } from '@/lib/types'

export function useRolGuard(rolesPermitidos: Role[]): {
  autorizado: boolean
  loading: boolean
} {
  const { usuario, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!usuario) {
      router.replace('/login')
      return
    }
    const tieneAcceso = usuario.roles.some((r) => rolesPermitidos.includes(r))
    if (!tieneAcceso) {
      router.replace(getRolDefaultRoute(usuario.roles))
    }
  }, [usuario, loading, router, rolesPermitidos])

  const autorizado =
    !loading &&
    !!usuario &&
    usuario.roles.some((r) => rolesPermitidos.includes(r))

  return { autorizado, loading }
}
