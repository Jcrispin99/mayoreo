/**
 * Cliente del API v1 para el panel web.
 *
 * El panel no tiene endpoints propios: consume el mismo /api/v1 que la app
 * móvil, autenticado con la cookie de sesión de Laravel (Sanctum en modo SPA)
 * y protegido contra CSRF con el token XSRF que Laravel deja en una cookie.
 */

type ApiEnvelope<T> = {
  success?: boolean
  message?: string
  data: T
}

type ErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }

  /** Primer mensaje de validación de un campo, si existe. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0]
  }
}

/** Mensajes de dominio del backend que todavía llegan en inglés. */
const KNOWN_MESSAGES: Array<[RegExp, string]> = [
  [/overlaps with an existing active price tier/i, "El rango se cruza con otro precio activo de esta presentación."],
  [/insufficient stock/i, "No hay stock suficiente en ese almacén para retirar esa cantidad."],
  [/This action is unauthorized/i, "No tienes permiso para realizar esta acción."],
  [/Unauthenticated/i, "Tu sesión expiró. Vuelve a iniciar sesión."],
  [/CSRF token mismatch/i, "La página caducó. Recárgala e inténtalo de nuevo."],
  [/Too Many Attempts/i, "Demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo."],
]

function translate(message: string): string {
  const known = KNOWN_MESSAGES.find(([pattern]) => pattern.test(message))
  return known ? known[1] : message
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  }
  const xsrfToken = readCookie("XSRF-TOKEN")
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken

  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: payload,
      credentials: "same-origin",
    })
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Revisa tu conexión.")
  }

  if (response.status === 204) return null as T

  const json = (await response.json().catch(() => null)) as (ApiEnvelope<T> & ErrorBody) | null

  if (!response.ok) {
    const errors = json?.errors ?? {}
    const firstError = Object.values(errors).flat()[0]
    const message = firstError ?? json?.message ?? `Error ${response.status}`
    throw new ApiError(response.status, translate(message), errors)
  }

  return (json?.data ?? null) as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) => {
    const query = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return
      query.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value))
    })
    const suffix = query.toString()
    return request<T>("GET", suffix ? `${path}?${suffix}` : path)
  },
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<null>("DELETE", path),
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  return fallback
}
