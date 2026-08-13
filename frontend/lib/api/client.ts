import type { z } from 'zod'
import { API_URL } from '../constants'
import type { ApiError, ApiResponse } from '../types'

export class ApiClientError extends Error {
  public constructor(
    public statusCode: number,
    message: string,
    public path: string
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export interface ApiFetchOptions<T> extends RequestInit {
  schema?: z.ZodType<T>
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions<T> = {}
): Promise<T> {
  const { schema, ...requestInit } = options

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...requestInit,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...requestInit.headers,
    },
  })

  // Intentar parsear el body siempre
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiClientError(
      response.status,
      `Error ${response.status}: ${response.statusText}`,
      endpoint
    )
  }

  // Si la respuesta no es ok, extraer el mensaje de error
  if (!response.ok) {
    const errorBody = body as Partial<ApiError>
    throw new ApiClientError(
      errorBody.statusCode ?? response.status,
      errorBody.message ?? `Error ${response.status}`,
      errorBody.path ?? endpoint
    )
  }

  // Respuesta exitosa
  const successBody = body as ApiResponse<T>
  const data = successBody.data

  // Validación Zod opcional
  if (schema) {
    const result = schema.safeParse(data)
    if (!result.success) {
      console.error(
        `Schema validation failed for ${endpoint}:`,
        result.error.flatten()
      )
      if (process.env.NODE_ENV === 'development') {
        throw new ApiClientError(
          500,
          `Response validation failed for ${endpoint}`,
          endpoint
        )
      }
    } else {
      return result.data
    }
  }

  return data
}
