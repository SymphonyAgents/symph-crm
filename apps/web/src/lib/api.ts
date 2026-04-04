// In dev: calls localhost:4000 directly (no rewrite in dev mode).
// In production: /api/* is proxied by Next.js to the NestJS Cloud Run service
// via the rewrites() config in next.config.ts — no NEXT_PUBLIC_ var needed.
const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api'

// ─── Auth header injection ────────────────────────────────────────────────────

let _cachedUserId: string | null = null
let _cacheExpiry = 0

/**
 * Resolve the current user ID from the NextAuth session cookie.
 * Cached for 1 minute to avoid repeated session fetches.
 * Exported so mutations.ts can reuse without re-fetching.
 */
export async function resolveUserId(): Promise<string | null> {
  if (_cachedUserId && Date.now() < _cacheExpiry) return _cachedUserId
  try {
    const res = await fetch('/api/auth/session')
    if (!res.ok) return null
    const session = await res.json()
    _cachedUserId = session?.user?.id ?? null
    _cacheExpiry = Date.now() + 60_000 // 1 minute
    return _cachedUserId
  } catch {
    return null
  }
}

// ─── Core fetcher ─────────────────────────────────────────────────────────────

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = await resolveUserId()
  const isFormData = init?.body instanceof FormData
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      // Don't set Content-Type for FormData — browser sets multipart/form-data + boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(userId ? { 'x-user-id': userId } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `API error: ${res.status}`)
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
