import posthog from 'posthog-js'

// In dev: calls localhost:4000 directly (no rewrite in dev mode).
// In production: /api/* is proxied by Next.js to the NestJS Cloud Run service
// via the rewrites() config in next.config.ts — no NEXT_PUBLIC_ var needed.
const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api'

// ─── Auth header injection ────────────────────────────────────────────────────

let _cachedUserId: string | null = null
let _hasCachedUserId = false
let _cacheExpiry = 0
let _pendingUserId: Promise<string | null> | null = null

/**
 * Resolve the current user ID from the NextAuth session cookie.
 * Cached for 1 minute to avoid repeated session fetches.
 * Exported so mutations.ts can reuse without re-fetching.
 */
export async function resolveUserId(): Promise<string | null> {
  if (_hasCachedUserId && Date.now() < _cacheExpiry) return _cachedUserId
  if (_pendingUserId) return _pendingUserId

  _pendingUserId = (async () => {
    const res = await fetch('/api/auth/session')
    if (!res.ok) {
      console.warn(`[api] /api/auth/session returned ${res.status}`)
      _cachedUserId = null
      _hasCachedUserId = true
      _cacheExpiry = Date.now() + 10_000
      return null
    }

    const session = await res.json()
    _cachedUserId = session?.user?.id ?? null
    _hasCachedUserId = true
    if (!_cachedUserId) {
      console.warn('[api] session.user.id not found:', session)
    }
    _cacheExpiry = Date.now() + 60_000 // 1 minute
    return _cachedUserId
  })()

  try {
    return await _pendingUserId
  } catch (err) {
    console.error('[api] resolveUserId failed:', err)
    _cachedUserId = null
    _hasCachedUserId = true
    _cacheExpiry = Date.now() + 10_000
    return null
  } finally {
    _pendingUserId = null
  }
}

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
