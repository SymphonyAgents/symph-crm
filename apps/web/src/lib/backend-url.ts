export function resolveBackendApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  const normalized = raw.replace(/\/+$/, '')
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

export const BACKEND_API_URL = resolveBackendApiUrl()
