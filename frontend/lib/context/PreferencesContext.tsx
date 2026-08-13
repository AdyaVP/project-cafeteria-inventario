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
import { z } from 'zod'

export const PreferencesSchema = z.object({
  sonidoAlertas: z.boolean(),
  vistaCompacta: z.boolean(),
  reducirMovimiento: z.boolean(),
})

export type Preferences = z.infer<typeof PreferencesSchema>

export const DEFAULT_PREFERENCES: Preferences = {
  // El usuario debe habilitarlo con una interacción para que el navegador
  // autorice el contexto de audio usado por las notificaciones posteriores.
  sonidoAlertas: false,
  vistaCompacta: false,
  reducirMovimiento: false,
}

interface PreferencesContextValue {
  preferences: Preferences
  hydrated: boolean
  savePreferences: (next: Preferences) => void
  resetPreferences: () => void
  playAlertSound: (force?: boolean) => Promise<boolean>
}

interface PreferencesProviderProps {
  children: ReactNode
}

const STORAGE_KEY = 'comanda:preferences:v1'
const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({
  children,
}: PreferencesProviderProps): React.JSX.Element {
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES)
  const [hydrated, setHydrated] = useState(false)
  const preferencesRef = useRef(preferences)
  const audioContextRef = useRef<AudioContext | null>(null)

  const ensureAudioContext = useCallback(async (): Promise<AudioContext> => {
    const context = audioContextRef.current ?? new AudioContext()
    audioContextRef.current = context

    if (context.state === 'suspended') {
      await context.resume()
    }

    return context
  }, [])

  const playAlertSound = useCallback(
    async (force = false): Promise<boolean> => {
      if (!force && !preferencesRef.current.sonidoAlertas) return false

      try {
        const context = await ensureAudioContext()
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const now = context.currentTime

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(660, now)
        oscillator.frequency.setValueAtTime(880, now + 0.09)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(now)
        oscillator.stop(now + 0.21)
        return true
      } catch {
        return false
      }
    },
    [ensureAudioContext]
  )

  const persist = useCallback(
    (next: Preferences): void => {
      const parsed = PreferencesSchema.parse(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      preferencesRef.current = parsed
      setPreferences(parsed)

      // La primera interacción del usuario deja preparado el contexto de audio
      // para que las alertas posteriores puedan sonar en navegadores estrictos.
      if (parsed.sonidoAlertas) {
        void ensureAudioContext().catch(() => undefined)
      }
    },
    [ensureAudioContext]
  )

  const resetPreferences = useCallback((): void => {
    persist(DEFAULT_PREFERENCES)
  }, [persist])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        const result = PreferencesSchema.safeParse(parsed)
        if (result.success) {
          preferencesRef.current = result.data
          setPreferences(result.data)
        }
      }
    } catch {
      // Una preferencia local inválida no debe impedir usar el sistema.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.comandaDensity = preferences.vistaCompacta
      ? 'compact'
      : 'comfortable'
    root.dataset.comandaMotion = preferences.reducirMovimiento
      ? 'reduced'
      : 'full'
  }, [preferences.reducirMovimiento, preferences.vistaCompacta])

  useEffect(
    () => () => {
      const context = audioContextRef.current
      audioContextRef.current = null
      if (context && context.state !== 'closed') {
        void context.close()
      }
    },
    []
  )

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      hydrated,
      savePreferences: persist,
      resetPreferences,
      playAlertSound,
    }),
    [hydrated, persist, playAlertSound, preferences, resetPreferences]
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext)
  if (!value) {
    throw new Error('usePreferences debe usarse dentro de PreferencesProvider')
  }
  return value
}
