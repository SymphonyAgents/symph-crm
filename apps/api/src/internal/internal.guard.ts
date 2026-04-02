import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

/**
 * InternalGuard — protects /api/internal/* endpoints from public access.
 *
 * MVP: verifies X-Internal-Secret header matches INTERNAL_SECRET env var.
 * The secret is generated once and stored in GCP Secret Manager.
 * Cloud Scheduler is configured to send it as a header via its HTTP target config.
 *
 * Upgrade path: swap header check for GCP OIDC token verification via
 * google-auth-library's OAuth2Client.verifyIdToken() — ~10 line change.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const secret = request.headers['x-internal-secret'] as string | string[] | undefined
    const secretStr = Array.isArray(secret) ? secret[0] : secret
    const expected = this.config.get<string>('INTERNAL_SECRET')

    if (!expected) {
      throw new UnauthorizedException('INTERNAL_SECRET not configured')
    }

    if (!secretStr || secretStr.trim() !== expected?.trim()) {
      throw new UnauthorizedException('Invalid internal secret')
    }

    return true
  }
}
