import { NextRequest, NextResponse } from 'next/server'
import { BACKEND_API_URL } from '@/lib/backend-url'

// OAuth compatibility shim only. Google redirects to the old web callback path,
// then this route forwards the signed callback params to the backend auth owner.
export function GET(request: NextRequest) {
  const target = new URL(`${BACKEND_API_URL}/auth/google/callback`, request.nextUrl.origin)
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value)
  })
  return NextResponse.redirect(target)
}
