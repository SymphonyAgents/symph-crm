import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import type { Request, Response } from 'express'
import { CrmAuthCookieName, CrmAuthTokenType, CRM_OAUTH_STATE_COOKIE } from './auth.constants'

type TokenType = CrmAuthTokenType

type CrmAuthPayload = {
  sub: string
  email: string
  typ: TokenType
  iat: number
  exp: number
}

const ACCESS_MAX_AGE_SECONDS = 15 * 60
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function decodeBase64Url(input: string): string {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), '=')
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

@Injectable()
export class AuthTokenService {
  constructor(private readonly config: ConfigService) {}

  sign(payload: Omit<CrmAuthPayload, 'iat' | 'exp'>, maxAgeSeconds: number): string {
    const now = Math.floor(Date.now() / 1000)
    const fullPayload: CrmAuthPayload = {
      ...payload,
      iat: now,
      exp: now + maxAgeSeconds,
    }
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = base64Url(JSON.stringify(header))
    const encodedPayload = base64Url(JSON.stringify(fullPayload))
    const signature = this.signature(`${encodedHeader}.${encodedPayload}`)
    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  verify(token: string, expectedType?: TokenType): CrmAuthPayload {
    const [encodedHeader, encodedPayload, signature] = token.split('.')
    if (!encodedHeader || !encodedPayload || !signature) throw new UnauthorizedException('Invalid auth token')

    const expectedSignature = this.signature(`${encodedHeader}.${encodedPayload}`)
    if (!timingSafeEqual(signature, expectedSignature)) throw new UnauthorizedException('Invalid auth token')

    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<CrmAuthPayload>
    if (!payload.sub || !payload.email || !payload.typ || !payload.exp) throw new UnauthorizedException('Invalid auth token')
    if (expectedType && payload.typ !== expectedType) throw new UnauthorizedException('Invalid auth token')
    if (payload.exp < Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Auth token expired')

    return payload as CrmAuthPayload
  }

  issueSession(res: Response, user: { id: string; email: string }): void {
    const accessToken = this.sign({ sub: user.id, email: user.email, typ: CrmAuthTokenType.Access }, ACCESS_MAX_AGE_SECONDS)
    const refreshToken = this.sign({ sub: user.id, email: user.email, typ: CrmAuthTokenType.Refresh }, REFRESH_MAX_AGE_SECONDS)
    res.cookie(CrmAuthCookieName.Access, accessToken, this.cookieOptions(ACCESS_MAX_AGE_SECONDS))
    res.cookie(CrmAuthCookieName.Refresh, refreshToken, this.cookieOptions(REFRESH_MAX_AGE_SECONDS))
  }

  clearSession(res: Response): void {
    res.clearCookie(CrmAuthCookieName.Access, this.clearCookieOptions())
    res.clearCookie(CrmAuthCookieName.Refresh, this.clearCookieOptions())
  }

  issueOAuthState(res: Response, state: string): void {
    res.cookie(CRM_OAUTH_STATE_COOKIE, state, this.cookieOptions(OAUTH_STATE_MAX_AGE_SECONDS))
  }

  clearOAuthState(res: Response): void {
    res.clearCookie(CRM_OAUTH_STATE_COOKIE, this.clearCookieOptions())
  }

  getOAuthState(req: Request): string | null {
    return this.getCookie(req, CRM_OAUTH_STATE_COOKIE)
  }

  getAccessPayload(req: Request): CrmAuthPayload | null {
    const token = this.getCookie(req, CrmAuthCookieName.Access)
    if (!token) return null
    return this.verify(token, CrmAuthTokenType.Access)
  }

  getRefreshPayload(req: Request): CrmAuthPayload | null {
    const token = this.getCookie(req, CrmAuthCookieName.Refresh)
    if (!token) return null
    return this.verify(token, CrmAuthTokenType.Refresh)
  }

  private signature(input: string): string {
    return base64Url(crypto.createHmac('sha256', this.secret()).update(input).digest())
  }

  private secret(): string {
    const secret = this.config.get<string>('CRM_AUTH_SECRET') ?? this.config.get<string>('AUTH_SECRET')
    if (!secret) throw new Error('CRM auth secret is not configured')
    return secret
  }

  private getCookie(req: Request, name: string): string | null {
    const cookieHeader = req.headers.cookie
    if (!cookieHeader) return null
    const cookies = cookieHeader.split(';').map(part => part.trim())
    const pair = cookies.find(part => part.startsWith(`${name}=`))
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null
  }

  private cookieOptions(maxAgeSeconds: number) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeSeconds * 1000,
      ...(this.cookieDomain() ? { domain: this.cookieDomain() } : {}),
    }
  }

  private clearCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      ...(this.cookieDomain() ? { domain: this.cookieDomain() } : {}),
    }
  }

  private cookieDomain(): string | undefined {
    return this.config.get<string>('CRM_AUTH_COOKIE_DOMAIN')?.trim() || undefined
  }
}
