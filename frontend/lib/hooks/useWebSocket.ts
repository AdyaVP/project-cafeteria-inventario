'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { WS_EVENTS, WS_NAMESPACE, WS_URL } from '../constants'

interface UseWebSocketReturn {
  socket: Socket | null
  connected: boolean
}
let sharedSocket: Socket | null = null
let subscribers = 0

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(sharedSocket)
  const [connected, setConnected] = useState(sharedSocket?.connected ?? false)
  useEffect(() => {
    subscribers += 1
    if (!sharedSocket)
      sharedSocket = io(`${WS_URL}${WS_NAMESPACE}`, {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket'],
      })
    const activeSocket = sharedSocket
    const onConnect = (): void => setConnected(true)
    const onDisconnect = (): void => setConnected(false)
    setSocket(activeSocket)
    setConnected(activeSocket.connected)
    activeSocket.on(WS_EVENTS.connect, onConnect)
    activeSocket.on(WS_EVENTS.disconnect, onDisconnect)
    return () => {
      activeSocket.off(WS_EVENTS.connect, onConnect)
      activeSocket.off(WS_EVENTS.disconnect, onDisconnect)
      subscribers -= 1
      if (subscribers === 0) {
        activeSocket.disconnect()
        sharedSocket = null
      }
      setSocket(null)
    }
  }, [])
  return { socket, connected }
}
