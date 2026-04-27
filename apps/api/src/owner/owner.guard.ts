import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

/**
 * OwnerGuard — protects /api/owner/* endpoints.
 *
 * Validates `x-api-key` header against the OWNER_API_KEY env var.
 * The secret is stored in GCP Secret Manager as `symph-crm-owner-api-key`
 * and injected as OWNER_API_KEY in Cloud Run.
 *
 * This guard is scoped exclusively to OwnerController and never intercepts
 * any other route. Existing /api/internal/*, /api/deals/*, etc. are unaffected.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const apiKey = request.headers['x-api-key'] as string | string[] | undefined
    const apiKeyStr = Array.isArray(apiKey) ? apiKey[0] : apiKey
    const expected = this.config.get<string>('OWNER_API_KEY')

    if (!expected) {
      throw new UnauthorizedException('OWNER_API_KEY not configured')
    }

    if (!apiKeyStr || apiKeyStr.trim() !== expected.trim()) {
      throw new UnauthorizedException('Invalid owner API key')
    }

    return true
  }
}
