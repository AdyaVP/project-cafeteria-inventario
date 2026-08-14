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
import { MAX_TOASTS, TOAST_DURATION_MS } from '../constants'
import type { ToastMessage, ToastType } from '../types'

interface ToastMethods {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}
interface ToastContextValue {
  toasts: ToastMessage[]
  toast: ToastMethods
  dismiss: (id: string) => void
}
interface ToastProviderProps {
  children: ReactNode
}
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({
  children,
}: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const dismiss = useCallback((id: string): void => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])
  const add = useCallback(
    (type: ToastType, message: string, duration = TOAST_DURATION_MS): void => {
      const item: ToastMessage = {
        id: crypto.randomUUID(),
        type,
        message,
        duration,
      }
      setToasts((current) => [...current, item].slice(-MAX_TOASTS))
      timers.current.set(
        item.id,
        setTimeout(() => dismiss(item.id), duration)
      )
    },
    [dismiss]
  )
  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach(clearTimeout)
      activeTimers.clear()
    }
  }, [])
  const toast = useMemo<ToastMethods>(
    () => ({
      success: (message) => add('success', message),
      error: (message) => add('error', message),
      warning: (message) => add('warning', message),
      info: (message) => add('info', message),
    }),
    [add]
  )
  const value = useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss]
  )
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider')
  return value
}
