import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CrmUserRole, CrmUserStatus } from '@symph-crm/shared'
import { BACKEND_API_URL } from '@/lib/backend-url'

type SessionUser = {
  role?: CrmUserRole
  status?: CrmUserStatus
  isOnboarded?: boolean
}

const AUTH_PATHS = new Set(['/login', '/onboarding', '/pending-approval'])
const PARTNER_ALLOWED_PATHS = new Set(['/deals', '/commissions', '/404'])

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.has(pathname)
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone()
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  url.pathname = '/login'
  url.search = returnTo && returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  return NextResponse.redirect(url)
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return NextResponse.redirect(url)
}

function isPartnerAllowedPath(pathname: string): boolean {
  return PARTNER_ALLOWED_PATHS.has(pathname) || pathname.startsWith('/deals/')
}

function notFoundRewrite(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/404'
  url.search = ''
  return NextResponse.rewrite(url, { status: 404 })
}

function passThroughSetCookie(source: Response, target: NextResponse): NextResponse {
  const headersWithSetCookie = source.headers as Headers & { getSetCookie?: () => string[] }
  const cookies = headersWithSetCookie.getSetCookie?.() ?? []
  if (cookies.length > 0) {
    for (const cookie of cookies) target.headers.append('set-cookie', cookie)
    return target
  }

  const setCookie = source.headers.get('set-cookie')
  if (setCookie) target.headers.append('set-cookie', setCookie)
  return target
}

async function fetchSession(request: NextRequest): Promise<{ response: Response; user: SessionUser | null } | null> {
  try {
    const sessionUrl = new URL(`${BACKEND_API_URL}/auth/session`, request.nextUrl.origin)
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    })
    if (!response.ok) return { response, user: null }
    const data = await response.json() as { user?: SessionUser | null }
    return { response, user: data.user ?? null }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const session = await fetchSession(request)
  const user = session?.user ?? null

  let response: NextResponse

  if (!user) {
    response = isAuthPath(pathname) ? NextResponse.next() : loginRedirect(request)
    return session ? passThroughSetCookie(session.response, response) : response
  }

  if (!session) return loginRedirect(request)

  if (user.status === CrmUserStatus.Rejected && pathname !== '/pending-approval') {
    response = redirectTo(request, '/pending-approval')
    return passThroughSetCookie(session.response, response)
  }

  if (user.status === CrmUserStatus.Pending && pathname !== '/onboarding') {
    response = redirectTo(request, '/onboarding')
    return passThroughSetCookie(session.response, response)
  }

  if (!user.isOnboarded && pathname !== '/onboarding') {
    response = redirectTo(request, '/onboarding')
    return passThroughSetCookie(session.response, response)
  }

  if (user.isOnboarded && isAuthPath(pathname)) {
    response = redirectTo(request, user.role === CrmUserRole.Partner ? '/deals' : '/')
    return passThroughSetCookie(session.response, response)
  }

  if (user.role === CrmUserRole.Partner && !isPartnerAllowedPath(pathname)) {
    response = notFoundRewrite(request)
    return passThroughSetCookie(session.response, response)
  }

  response = NextResponse.next()
  return passThroughSetCookie(session.response, response)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|sw\\.js|workbox-.*\\.js|manifest\\.webmanifest).*)',
  ],
}
