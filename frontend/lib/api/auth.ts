import { apiFetch } from './client'
import type { Usuario } from '../types'

interface LoginResponse {
  user: Usuario
  message: string
}

export const authApi = {
  login: async (email: string, password: string): Promise<Usuario> => {
    const response = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    return response.user
  },
  logout: (): Promise<void> => apiFetch('/auth/logout', { method: 'POST' }),
  getMe: (opts?: { signal?: AbortSignal }): Promise<Usuario> =>
    apiFetch('/auth/me', { signal: opts?.signal }),
}
