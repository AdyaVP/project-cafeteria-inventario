'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '../api/auth'
import { ApiClientError } from '../api/client'
import { AUTH_SESSION_REVALIDATE_EVENT } from '../constants'
import { disconnectWebSocket, restartWebSocket } from '../hooks/useWebSocket'
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

function sameIdentityAndRoles(current: Usuario, next: Usuario): boolean {
  return (
    current.id === next.id &&
    current.roles.length === next.roles.length &&
    current.roles.every((role) => next.roles.includes(role))
  )
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const usuarioRef = useRef<Usuario | null>(null)
  const activeVerificationRef = useRef<AbortController | null>(null)
  const authTransitionRef = useRef(false)
  const verificationSequenceRef = useRef(0)
  const router = useRouter()

  const storeUsuario = useCallback((next: Usuario | null): void => {
    usuarioRef.current = next
    setUsuario(next)
  }, [])

  const cancelVerification = useCallback((): void => {
    verificationSequenceRef.current += 1
    activeVerificationRef.current?.abort()
    activeVerificationRef.current = null
  }, [])

  const clearExpiredSession = useCallback((): void => {
    disconnectWebSocket()
    storeUsuario(null)

    if (window.location.pathname !== '/login') {
      router.replace('/login')
    }
  }, [router, storeUsuario])

  const verifySession = useCallback(
    async (forceSocketRestart = false): Promise<void> => {
      if (authTransitionRef.current) return

      activeVerificationRef.current?.abort()
      const controller = new AbortController()
      const sequence = verificationSequenceRef.current + 1
      verificationSequenceRef.current = sequence
      activeVerificationRef.current = controller

      try {
        const nextUsuario = await authApi.getMe({ signal: controller.signal })
        if (
          controller.signal.aborted ||
          verificationSequenceRef.current !== sequence
        ) {
          return
        }

        const currentUsuario = usuarioRef.current
        if (
          forceSocketRestart ||
          (currentUsuario && !sameIdentityAndRoles(currentUsuario, nextUsuario))
        ) {
          restartWebSocket()
        }
        storeUsuario(nextUsuario)
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return
        if (verificationSequenceRef.current !== sequence) return

        if (
          error instanceof ApiClientError &&
          (error.statusCode === 401 || error.statusCode === 403)
        ) {
          clearExpiredSession()
        } else if (!usuarioRef.current) {
          storeUsuario(null)
        }
      } finally {
        if (
          !controller.signal.aborted &&
          verificationSequenceRef.current === sequence
        ) {
          activeVerificationRef.current = null
          setLoading(false)
        }
      }
    },
    [clearExpiredSession, storeUsuario]
  )

  useEffect(() => {
    const revalidateOnFocus = (): void => {
      void verifySession()
    }
    const revalidateWhenVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void verifySession()
      }
    }
    const revalidateAfterAuthorizationChange = (): void => {
      void verifySession(true)
    }

    void verifySession()
    window.addEventListener('focus', revalidateOnFocus)
    document.addEventListener('visibilitychange', revalidateWhenVisible)
    window.addEventListener(
      AUTH_SESSION_REVALIDATE_EVENT,
      revalidateAfterAuthorizationChange
    )

    return () => {
      window.removeEventListener('focus', revalidateOnFocus)
      document.removeEventListener('visibilitychange', revalidateWhenVisible)
      window.removeEventListener(
        AUTH_SESSION_REVALIDATE_EVENT,
        revalidateAfterAuthorizationChange
      )
      cancelVerification()
    }
  }, [cancelVerification, verifySession])

  const login = useCallback(
    async (email: string, password: string): Promise<Usuario> => {
      authTransitionRef.current = true
      cancelVerification()
      try {
        const data = await authApi.login(email, password)
        const currentUsuario = usuarioRef.current
        if (currentUsuario && !sameIdentityAndRoles(currentUsuario, data)) {
          restartWebSocket()
        }
        storeUsuario(data)
        setLoading(false)
        return data
      } finally {
        authTransitionRef.current = false
      }
    },
    [cancelVerification, storeUsuario]
  )

  const logout = useCallback(async (): Promise<void> => {
    authTransitionRef.current = true
    cancelVerification()
    disconnectWebSocket()

    try {
      await authApi.logout()
      disconnectWebSocket()
      storeUsuario(null)
      setLoading(false)
    } catch (error: unknown) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        storeUsuario(null)
        setLoading(false)
        return
      }

      // La cookie es HttpOnly: si el servidor no confirmó el logout, la
      // sesión sigue siendo válida y no debe aparentar haberse cerrado.
      authTransitionRef.current = false
      restartWebSocket()
      await verifySession()
      throw error
    } finally {
      authTransitionRef.current = false
    }
  }, [cancelVerification, storeUsuario, verifySession])

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
