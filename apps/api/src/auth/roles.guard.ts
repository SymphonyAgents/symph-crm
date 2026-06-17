import { Injectable, CanActivate, ExecutionContext, Inject, SetMetadata, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { eq } from 'drizzle-orm'
import type { Response } from 'express'
import { users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import {
  CrmUserRole,
  CrmUserStatus,
  isBypassPrefixPath,
  isOptionsMethod,
  isReadMethod,
  MUTATION_ALLOWED_ROLES,
  SESSION_SCOPED_READ_ROLES,
  SESSIONLESS_AUTH_PATHS,
  STATUS_EXEMPT_PATHS,
} from './auth.constants'
import { AuthTokenService } from './auth-token.service'
import type { CrmAuthenticatedRequest } from './current-user.decorator'

// Mark a route as requiring one of the listed roles.
// When no @Roles() decorator is present, the guard falls back to
// method-based rules: GET/HEAD require an internal role, mutations require SALES.
export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

function getPathname(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname
  } catch {
    return url.split('?')[0] || '/'
  }
}

// Global guard that enforces role-based access on every user-session request.
//
// Public, internal, and owner API families keep their own route guards. Normal CRM
// routes authenticate through backend-owned CRM auth cookies.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokens: AuthTokenService,
    @Inject(DB) private db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CrmAuthenticatedRequest>()
    const method = request.method as string
    const pathname = getPathname(request.url || '')

    if (isOptionsMethod(method)) return true

    // Internal routes (/api/internal/*) have their own InternalGuard (X-Internal-Secret).
    // Owner routes (/api/owner/*) have their own OwnerGuard (x-api-key).
    // Public routes (/api/public/*) authenticate via opaque tokens validated downstream.
    if (isBypassPrefixPath(pathname)) {
      return true
    }

    if (SESSIONLESS_AUTH_PATHS.has(pathname)) return true

    const backendSession = this.resolveBackendSession(request)

    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const userId = backendSession.userId
    if (!userId) {
      throw new ForbiddenException('You do not have permission to access the CRM.')
    }

    const [user] = await this.db
      .select({ role: users.role, status: users.status, isActive: users.isActive, deletedAt: users.deletedAt, email: users.email })
      .from(users)
      .where(eq(users.id, userId))

    if (!user || user.deletedAt) {
      throw new ForbiddenException('You do not have permission to access the CRM.')
    }

    request.crmUser = {
      id: userId,
      email: user.email,
      role: user.role as CrmUserRole,
      status: user.status as CrmUserStatus,
      isActive: user.isActive,
    }

    if (backendSession.shouldRefresh && user.email) {
      const response = context.switchToHttp().getResponse<Response>()
      this.tokens.issueSession(response, { id: userId, email: user.email })
    }

    if (!STATUS_EXEMPT_PATHS.has(pathname) && (user.status !== CrmUserStatus.Active || !user.isActive)) {
      throw new ForbiddenException(
        user.status === CrmUserStatus.Pending
          ? 'Your account is pending approval.'
          : 'Your account is not active.',
      )
    }

    if (requiredRoles) {
      if (requiredRoles.includes(user.role)) return true
      throw new ForbiddenException('You do not have permission to access this page.')
    }

    if (isReadMethod(method)) {
      if (SESSION_SCOPED_READ_ROLES.has(user.role as CrmUserRole)) return true
      throw new ForbiddenException('You do not have permission to access this CRM data.')
    }

    if (MUTATION_ALLOWED_ROLES.has(user.role as CrmUserRole)) return true
    throw new ForbiddenException('You do not have permission to make CRM changes.')
  }

  private resolveBackendSession(request: CrmAuthenticatedRequest): { userId: string | null; shouldRefresh: boolean } {
    try {
      const accessPayload = this.tokens.getAccessPayload(request)
      if (accessPayload?.sub) return { userId: accessPayload.sub, shouldRefresh: false }
    } catch {
      // Access token may be expired or malformed. Fall through to refresh token.
    }

    try {
      const refreshPayload = this.tokens.getRefreshPayload(request)
      if (refreshPayload?.sub) return { userId: refreshPayload.sub, shouldRefresh: true }
    } catch {
      return { userId: null, shouldRefresh: false }
    }

    return { userId: null, shouldRefresh: false }
  }
}
