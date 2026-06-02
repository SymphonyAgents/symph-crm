import posthog from 'posthog-js'
import { BACKEND_API_URL } from '@/lib/backend-url'

const API_BASE = BACKEND_API_URL

// ─── Core fetcher ─────────────────────────────────────────────────────────────

function sanitizePath(path: string) {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\?.*$/, '')
}

function captureApiError(input: {
  path: string
  method: string
  status: number
  message: string
  requestId: string | null
}) {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.capture('api_error', {
    path: sanitizePath(input.path),
    method: input.method,
    status: input.status,
    message: input.message,
    request_id: input.requestId,
  })
}

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      // Don't set Content-Type for FormData — browser sets multipart/form-data + boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; requestId?: string }
    const message = err.message || `API error: ${res.status}`
    const requestId = err.requestId ?? res.headers.get('x-request-id')
    captureApiError({
      path,
      method: init?.method ?? 'GET',
      status: res.status,
      message,
      requestId,
    })
    throw new Error(message)
  }
  // 204 No Content or empty body (some DELETE endpoints return 200 with no body)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text)
}

// ─── Public API client ────────────────────────────────────────────────────────

export const api = {
  /** GET with optional query params. Params with undefined/null values are omitted. */
  get: <T>(path: string, query?: Record<string, string | number | boolean | null | undefined>) => {
    if (query) {
      const defined = Object.entries(query).filter(([, v]) => v !== undefined && v !== null)
      if (defined.length) {
        path = `${path}?${new URLSearchParams(defined.map(([k, v]) => [k, String(v)])).toString()}`
      }
    }
    return fetcher<T>(path)
  },
  post: <T>(path: string, body: unknown) =>
    fetcher<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    fetcher<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    fetcher<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = void>(path: string) =>
    fetcher<T>(path, { method: 'DELETE' }),
  /** POST with FormData (file uploads). */
  upload: <T>(path: string, formData: FormData) =>
    fetcher<T>(path, { method: 'POST', body: formData }),
}
