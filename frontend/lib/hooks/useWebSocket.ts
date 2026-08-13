'use client'

import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  AUTH_SESSION_REVALIDATE_EVENT,
  WS_EVENTS,
  WS_NAMESPACE,
  WS_URL,
} from '../constants'

interface UseWebSocketReturn {
  socket: Socket | null
  connected: boolean
}

const EMPTY_SNAPSHOT: UseWebSocketReturn = {
  socket: null,
  connected: false,
}

let sharedSocket: Socket | null = null
let sharedSnapshot: UseWebSocketReturn = EMPTY_SNAPSHOT
let onSharedConnect: (() => void) | null = null
let onSharedDisconnect: ((reason: Socket.DisconnectReason) => void) | null =
  null
const subscribers = new Set<() => void>()

function publishSnapshot(socket: Socket | null, connected: boolean): void {
  if (
    sharedSnapshot.socket === socket &&
    sharedSnapshot.connected === connected
  ) {
    return
  }

  sharedSnapshot = { socket, connected }
  subscribers.forEach((notify) => notify())
}

function createSharedSocket(): Socket {
  const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    transports: ['websocket'],
  })

  onSharedConnect = (): void => {
    if (sharedSocket === socket) publishSnapshot(socket, true)
  }
  onSharedDisconnect = (reason): void => {
    if (sharedSocket === socket) publishSnapshot(socket, false)
    if (reason === 'io server disconnect') {
      window.dispatchEvent(new Event(AUTH_SESSION_REVALIDATE_EVENT))
    }
  }

  socket.on(WS_EVENTS.connect, onSharedConnect)
  socket.on(WS_EVENTS.disconnect, onSharedDisconnect)
  sharedSocket = socket
  publishSnapshot(socket, socket.connected)

  return socket
}

function ensureSharedSocket(): Socket {
  return sharedSocket ?? createSharedSocket()
}

/**
 * Cierra el socket autenticado actual y evita que una identidad anterior siga
 * recibiendo eventos después de cerrar sesión.
 */
export function disconnectWebSocket(): void {
  const socket = sharedSocket
  const connectHandler = onSharedConnect
  const disconnectHandler = onSharedDisconnect

  sharedSocket = null
  onSharedConnect = null
  onSharedDisconnect = null

  if (socket) {
    if (connectHandler) socket.off(WS_EVENTS.connect, connectHandler)
    if (disconnectHandler) socket.off(WS_EVENTS.disconnect, disconnectHandler)
    socket.disconnect()
  }

  publishSnapshot(null, false)
}

/**
 * Fuerza un handshake nuevo cuando /auth/me detecta que cambió el usuario o
 * sus roles. Solo reconecta si alguna vista está usando el socket.
 */
export function restartWebSocket(): void {
  const shouldReconnect = subscribers.size > 0
  disconnectWebSocket()
  if (shouldReconnect) createSharedSocket()
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify)
  ensureSharedSocket()

  return () => {
    subscribers.delete(notify)
    if (subscribers.size === 0) disconnectWebSocket()
  }
}

function getSnapshot(): UseWebSocketReturn {
  return sharedSnapshot
}

function getServerSnapshot(): UseWebSocketReturn {
  return EMPTY_SNAPSHOT
}

export function useWebSocket(): UseWebSocketReturn {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
