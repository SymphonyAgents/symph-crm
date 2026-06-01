import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

function resolveApiUrl() {
  const raw = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
  const normalized = raw.replace(/\/+$/, '')
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

const API_URL = resolveApiUrl()

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

type RouteContext = { params: Promise<{ path?: string[] }> }

async function proxy(request: NextRequest, context: RouteContext) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const internalSecret = process.env.INTERNAL_SECRET
  if (!internalSecret) {
    return NextResponse.json({ message: 'API bridge is not configured' }, { status: 500 })
  }

  const { path = [] } = await context.params
  const targetPath = path.map(segment => encodeURIComponent(segment)).join('/')
  const search = request.nextUrl.search
  const targetUrl = `${API_URL.replace(/\/$/, '')}/${targetPath}${search}`

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) return
    if (normalizedKey === 'cookie') return
    if (normalizedKey === 'x-user-id') return
    if (normalizedKey === 'x-internal-secret') return
    headers.set(key, value)
  })
  headers.set('x-user-id', userId)
  headers.set('x-internal-secret', internalSecret)

  const method = request.method.toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  })

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location')
    if (location) return NextResponse.redirect(location, response.status)
  }

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value)
  })

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
