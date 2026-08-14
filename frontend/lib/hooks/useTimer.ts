'use client'

import { useEffect, useState } from 'react'

function elapsed(desde?: string): string {
  if (!desde) return '—'
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(desde).getTime()) / 60000)
  )
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function clock(): string {
  return new Date().toLocaleTimeString('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function useTimer(desde?: string): string {
  const [value, setValue] = useState('—')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const tick = (): void => setValue(elapsed(desde))
    tick()
    const timer = setInterval(tick, 60000)
    return () => clearInterval(timer)
  }, [desde])

  return mounted ? value : '—'
}

export function useClock(): string {
  const [value, setValue] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const tick = (): void => setValue(clock())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  return mounted ? value : ''
}

export function useCurrentDate(): string {
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(
      new Date().toLocaleDateString('es-HN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    )
  }, [])

  return value
}
