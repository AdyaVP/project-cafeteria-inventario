'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '../api/auth'
import type { Usuario } from '../types'

interface AuthContextValue {
  usuario: Usuario | null
  loading: boolean
  login: (email: string, password: string) => Promise<Usuario>
  logout: () => Promise<void>
}

interface AuthProviderProps {
  children: ReactNode
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  // Al montar: verificar sesión una sola vez
  // Si falla (401/403): usuario queda null
  // El middleware ya redirigió si no hay cookie
  useEffect(() => {
    const controller = new AbortController()

    // No verificar sesión en rutas públicas
    if (
      typeof window !== 'undefined' &&
      window.location.pathname === '/login'
    ) {
      setLoading(false)
      return
    }

    const verificar = async (): Promise<void> => {
      try {
        const data = await authApi.getMe({ signal: controller.signal })
        setUsuario(data)
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return
        // Sin sesión válida — usuario queda null
        setUsuario(null)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void verificar()

    return () => {
      controller.abort()
    }
  }, []) // Solo al montar — una vez

  const login = useCallback(
    async (email: string, password: string): Promise<Usuario> => {
      const data = await authApi.login(email, password)
      setUsuario(data)
      return data
    },
    []
  )

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout()
    } finally {
      setUsuario(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ usuario, loading, login, logout }),
    [usuario, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return value
}
