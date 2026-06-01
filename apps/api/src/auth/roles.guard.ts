import { Injectable, CanActivate, ExecutionContext, Inject, SetMetadata, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

/**
 * Mark a route as requiring one of the listed roles.
 * When no @Roles() decorator is present, the guard falls back to
 * method-based rules: GET/HEAD require an internal role, mutations require SALES.
 */
export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

const SESSIONLESS_CALLBACK_PATHS = new Set(['/api/auth/google-calendar/callback', '/auth/google-calendar/callback'])
const TRUSTED_BRIDGE_PATHS = new Set(['/api/users/sync', '/users/sync', '/api/users/onboarding', '/users/onboarding'])
const STATUS_EXEMPT_PATHS = new Set(['/api/users/me', '/users/me'])
const SESSION_SCOPED_READ_ROLES = new Set(['SALES', 'BUILD'])

function getPathname(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname
  } catch {
    return url.split('?')[0] || '/'
  }
}

function hasPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
}

/**
 * Global guard that enforces role-based access on every user-session request.
 *
 * Public, internal, and owner API families keep their own route guards. Normal CRM
 * routes must come through the trusted Next.js server bridge, which injects the
 * internal secret and the DB-backed user id from the authenticated session.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
    @Inject(DB) private db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const method = request.method as string
    const pathname = getPathname(request.url || '')

    if (method === 'OPTIONS') return true

    // Internal routes (/api/internal/*) have their own InternalGuard (X-Internal-Secret).
    // Owner routes (/api/owner/*) have their own OwnerGuard (x-api-key).
    // Public routes (/api/public/*) authenticate via opaque tokens validated downstream.
    if (
      hasPathPrefix(pathname, '/api/internal/')
      || hasPathPrefix(pathname, '/internal/')
      || hasPathPrefix(pathname, '/api/owner/')
      || hasPathPrefix(pathname, '/owner/')
      || hasPathPrefix(pathname, '/api/public/')
      || hasPathPrefix(pathname, '/public/')
    ) {
      return true
    }

    if (SESSIONLESS_CALLBACK_PATHS.has(pathname)) return true

    if (!this.hasTrustedBridgeSecret(request)) {
      throw new ForbiddenException('Invalid CRM session.')
    }

    if (TRUSTED_BRIDGE_PATHS.has(pathname)) return true

    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const userId = this.firstHeader(request.headers['x-user-id'])
    if (!userId) {
      throw new ForbiddenException('You do not have permission to access the CRM.')
    }

    const [user] = await this.db
      .select({ role: users.role, status: users.status, isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))

    if (!user || user.deletedAt) {
      throw new ForbiddenException('You do not have permission to access the CRM.')
    }

    if (!STATUS_EXEMPT_PATHS.has(pathname) && (user.status !== 'active' || !user.isActive)) {
      throw new ForbiddenException(
        user.status === 'pending'
          ? 'Your account is pending approval.'
          : 'Your account is not active.',
      )
    }

    if (requiredRoles) {
      if (requiredRoles.includes(user.role)) return true
      throw new ForbiddenException('You do not have permission to access this page.')
    }

    if (['GET', 'HEAD'].includes(method)) {
      if (SESSION_SCOPED_READ_ROLES.has(user.role)) return true
      throw new ForbiddenException('You do not have permission to access this CRM data.')
    }

    if (user.role === 'SALES') return true
    throw new ForbiddenException('You do not have permission to make CRM changes.')
  }

  private hasTrustedBridgeSecret(request: { headers: Record<string, string | string[] | undefined> }): boolean {
    const expected = this.config.get<string>('INTERNAL_SECRET')?.trim()
    if (!expected && process.env.NODE_ENV !== 'production') return true
    if (!expected) return false
    return this.firstHeader(request.headers['x-internal-secret'])?.trim() === expected
  }

  private firstHeader(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value
  }
}
