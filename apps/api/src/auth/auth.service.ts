import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { google } from 'googleapis'
import type { Request, Response } from 'express'
import { UsersService } from '../users/users.service'
import { AuthTokenService } from './auth-token.service'

const GOOGLE_SCOPES = ['openid', 'email', 'profile']

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly tokens: AuthTokenService,
  ) {}

  getGoogleAuthorizationUrl(res: Response, returnTo?: string): string {
    const client = this.googleClient()
    const nonce = crypto.randomBytes(32).toString('base64url')
    const state = Buffer.from(JSON.stringify({ returnTo: this.safeReturnTo(returnTo), nonce })).toString('base64url')
    this.tokens.issueOAuthState(res, nonce)
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account',
      scope: GOOGLE_SCOPES,
      state,
    })
  }

  async handleGoogleCallback(code: string | undefined, state: string | undefined, req: Request, res: Response): Promise<string> {
    if (!code) throw new BadRequestException('Missing Google authorization code')

    const statePayload = this.readState(state)
    const expectedNonce = this.tokens.getOAuthState(req)
    this.tokens.clearOAuthState(res)
    if (!statePayload?.nonce || !expectedNonce || statePayload.nonce !== expectedNonce) {
      throw new BadRequestException('Invalid Google OAuth state')
    }

    const client = this.googleClient()
    let googleUser: { id?: string | null; email?: string | null; name?: string | null; picture?: string | null }
    try {
      const { tokens } = await client.getToken(code)
      client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: client })
      googleUser = (await oauth2.userinfo.get()).data
    } catch {
      throw new UnauthorizedException('Google authorization failed')
    }

    if (!googleUser.id || !googleUser.email) throw new UnauthorizedException('Google account did not return an email')

    const user = await this.users.sync({
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name ?? null,
      image: googleUser.picture ?? null,
    })

    if (!user.email) throw new UnauthorizedException('CRM user has no email')

    this.tokens.issueSession(res, { id: user.id, email: user.email })
    return this.safeReturnTo(statePayload.returnTo)
  }

  async getSession(req: Request, res?: Response) {
    try {
      const accessPayload = this.tokens.getAccessPayload(req)
      if (accessPayload) {
        const user = await this.users.findSessionUser(accessPayload.sub)
        return user ? { user } : { user: null }
      }
    } catch {
      // Access token may be expired or malformed. Try refresh token below.
    }

    try {
      const refreshPayload = this.tokens.getRefreshPayload(req)
      if (!refreshPayload) return { user: null }

      const user = await this.users.findSessionUser(refreshPayload.sub)
      if (!user?.email) return { user: null }
      if (res) this.tokens.issueSession(res, { id: user.id, email: user.email })
      return { user }
    } catch {
      return { user: null }
    }
  }

  logout(res: Response): { ok: true } {
    this.tokens.clearSession(res)
    return { ok: true }
  }

  private googleClient() {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID')
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET')
    return new google.auth.OAuth2(clientId, clientSecret, this.googleRedirectUri())
  }

  private googleRedirectUri(): string {
    return this.config.get<string>('CRM_AUTH_GOOGLE_REDIRECT_URI')
      ?? `${this.webBaseUrl()}/api/auth/callback/google`
  }

  private webBaseUrl(): string {
    return (this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000').replace(/\/+$/, '')
  }

  private readState(state: string | undefined): { returnTo?: string; nonce?: string } | null {
    if (!state) return null
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { returnTo?: unknown; nonce?: unknown }
      return {
        returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : undefined,
        nonce: typeof parsed.nonce === 'string' ? parsed.nonce : undefined,
      }
    } catch {
      return null
    }
  }

  private safeReturnTo(returnTo: string | undefined): string {
    if (!returnTo) return this.webBaseUrl()
    if (returnTo.startsWith('/')) return `${this.webBaseUrl()}${returnTo}`
    try {
      const url = new URL(returnTo)
      if (url.origin === this.webBaseUrl()) return url.toString()
    } catch {
      return this.webBaseUrl()
    }
    return this.webBaseUrl()
  }
}
