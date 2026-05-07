import { Injectable, CanActivate, ExecutionContext, Inject, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { eq } from 'drizzle-orm'
import { users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

/**
 * Mark a route as requiring one of the listed roles.
 * When no @Roles() decorator is present, the guard falls back to
 * method-based rules: GET/OPTIONS/HEAD → allow all, mutations → SALES only.
 */
export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

/**
 * Global guard that enforces role-based access on every request.
 *
 * Rules:
 *   1. If the route has @Roles(...), the user must have one of those roles.
 *   2. If no @Roles() decorator, GET/OPTIONS/HEAD are open to all authenticated users.
 *   3. Mutations (POST/PUT/PATCH/DELETE) require SALES role by default.
 *   4. Certain paths are always open (user sync, onboarding).
 *
 * The user ID comes from the `x-user-id` header set by the web app.
 * The role is looked up from the DB — never trusted from a header.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(DB) private db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const method = request.method as string
    const url: string = request.url || ''

    // Always allow preflight and health checks
    if (method === 'OPTIONS') return true

    // Always allow auth-related endpoints (sync + onboarding)
    if (url.includes('/users/sync') || url.includes('/users/onboarding')) return true

    // Internal routes (/api/internal/*) have their own InternalGuard (X-Internal-Secret).
    // Owner routes (/api/owner/*) have their own OwnerGuard (x-api-key).
    // Skip RolesGuard for both, they are not user-session-scoped.
    if (url.includes('/internal/') || url.includes('/owner/')) return true

    // Check for explicit @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // If GET/HEAD and no explicit @Roles(), allow all authenticated users
    if (!requiredRoles && ['GET', 'HEAD'].includes(method)) return true

    // For mutations (or @Roles()-decorated reads), resolve user role from DB
    const userId = request.headers['x-user-id'] as string | undefined
    if (!userId) {
      // No user context — block mutations, allow reads
      return ['GET', 'HEAD'].includes(method)
    }

    const [user] = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))

    if (!user) return false

    // If @Roles() is set, check against those
    if (requiredRoles) {
      return requiredRoles.includes(user.role)
    }

    // Default: mutations require SALES
    return user.role === 'SALES'
  }
}
