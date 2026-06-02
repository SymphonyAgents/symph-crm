export function resolveBackendApiUrl(): string {
  // Browser and middleware auth calls must stay same-origin so backend-owned
  // cookies attach to crm.symph.co instead of the raw Cloud Run API host.
  const raw = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  const normalized = raw.replace(/\/+$/, '') || '/api'
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

export const BACKEND_API_URL = resolveBackendApiUrl()
