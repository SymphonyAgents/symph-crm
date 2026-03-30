import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

/**
 * Emails that are auto-assigned the SALES role on first sign-in.
 * Everyone else defaults to BUILD.
 */
const SALES_EMAILS = new Set([
  'mary.amora@symph.co',
  'gee@symph.co',
  'gee.quidet@symph.co',
  'chelle@symph.co',
  'chelle.gray@symph.co',
  'lyra.gemparo@symph.co',
  'kate.labra@symph.co',
  'vince.tapdasan@symph.co',
])

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
  ) {}

  /**
   * Upsert a user from NextAuth signIn callback.
   * Called once per login — keeps public.users in sync with Google OAuth identity.
   * Auto-assigns SALES role for known email list; everyone else gets BUILD.
   * id = NextAuth user.id (Google OAuth sub claim)
   */
  async sync(data: { id: string; email: string; name?: string | null; image?: string | null }) {
    const role: 'SALES' | 'BUILD' = SALES_EMAILS.has(data.email) ? 'SALES' : 'BUILD'

    const [user] = await this.db
      .insert(users)
      .values({
        id: data.id,
        email: data.email,
        name: data.name ?? null,
        image: data.image ?? null,
        role,
      })
      .onConflictDoUpdate({
        // Conflict on email (not id) — the same Google account can generate
        // different OAuth UUIDs across sessions when no DB adapter is used.
        // Email is the stable identifier from Google OAuth.
        target: users.email,
        set: {
          name: data.name ?? null,
          image: data.image ?? null,
          role, // re-apply on every login in case email list changes
          updatedAt: new Date(),
          // Note: we intentionally do NOT update `id` here.
          // The existing DB id is kept stable so JWT token.id stays consistent.
        },
      })
      .returning()

    return user
  }

  /**
   * Complete onboarding for a user.
   * Sets profile fields and marks isOnboarded = true.
   */
  async completeOnboarding(
    id: string,
    data: {
      firstName: string
      middleName: string
      lastName: string
      nickname?: string | null
    },
  ) {
    const [user] = await this.db
      .update(users)
      .set({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        nickname: data.nickname ?? null,
        isOnboarded: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    this.auditLogs.log({
      action: 'update',
      auditType: 'user_onboarded',
      entityType: 'user',
      entityId: id,
      performedBy: id,
      details: {
        firstName: data.firstName,
        lastName: data.lastName,
        nickname: data.nickname ?? null,
      },
    }).catch(() => {})

    return user
  }

  async findOne(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id))
    return user ?? null
  }

  async findAll() {
    return this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        isOnboarded: users.isOnboarded,
        firstName: users.firstName,
        lastName: users.lastName,
        nickname: users.nickname,
      })
      .from(users)
  }
}
