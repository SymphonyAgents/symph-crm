// In dev: calls localhost:4000 directly (no rewrite in dev mode).
// In production: /api/* is proxied by Next.js to the NestJS Cloud Run service
// via the rewrites() config in next.config.ts — no NEXT_PUBLIC_ var needed.
const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api'

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  get: <T>(path: string) => fetcher<T>(path),
  post: <T>(path: string, body: unknown) => fetcher<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => fetcher<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => fetcher<T>(path, { method: 'DELETE' }),
}
