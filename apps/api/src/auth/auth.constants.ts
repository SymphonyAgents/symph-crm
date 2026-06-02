import { CrmAuthCookieName, CrmAuthTokenType, CrmUserRole, CrmUserStatus, HttpMethod } from '@symph-crm/shared'

export { CrmAuthCookieName, CrmAuthTokenType, CrmUserRole, CrmUserStatus, HttpMethod }

export const CRM_OAUTH_STATE_COOKIE = 'crm_oauth_state'

export const CRM_AUTH_ROUTE = {
  google: '/auth/google',
  googleCallback: '/auth/google/callback',
  session: '/auth/session',
  logout: '/auth/logout',
  googleCalendarCallback: '/auth/google-calendar/callback',
} as const

export const CRM_USER_ROUTE = {
  sync: '/users/sync',
  onboarding: '/users/onboarding',
  me: '/users/me',
} as const

export const CRM_ROUTE_PREFIX = {
  internal: '/internal/',
  owner: '/owner/',
  public: '/public/',
} as const

function withApiPrefix(path: string): string[] {
  return [path, `/api${path}`]
}

export const SESSIONLESS_AUTH_PATHS = new Set<string>([
  ...withApiPrefix(CRM_AUTH_ROUTE.googleCalendarCallback),
  ...withApiPrefix(CRM_AUTH_ROUTE.google),
  ...withApiPrefix(CRM_AUTH_ROUTE.googleCallback),
  ...withApiPrefix(CRM_AUTH_ROUTE.session),
  ...withApiPrefix(CRM_AUTH_ROUTE.logout),
])

export const STATUS_EXEMPT_PATHS = new Set<string>([
  ...withApiPrefix(CRM_USER_ROUTE.me),
  ...withApiPrefix(CRM_USER_ROUTE.onboarding),
])

export const SESSION_SCOPED_READ_ROLES = new Set<CrmUserRole>([
  CrmUserRole.Sales,
  CrmUserRole.Build,
])

export const MUTATION_ALLOWED_ROLES = new Set<CrmUserRole>([
  CrmUserRole.Sales,
])

export function isReadMethod(method: string): boolean {
  return method === HttpMethod.Get || method === HttpMethod.Head
}

export function isOptionsMethod(method: string): boolean {
  return method === HttpMethod.Options
}

export function isBypassPrefixPath(pathname: string): boolean {
  return Object.values(CRM_ROUTE_PREFIX).some(prefix => {
    const apiPrefix = `/api${prefix}`
    return pathname === prefix.slice(0, -1)
      || pathname.startsWith(prefix)
      || pathname === apiPrefix.slice(0, -1)
      || pathname.startsWith(apiPrefix)
  })
}
