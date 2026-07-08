import { BadRequestException, Injectable, Inject, NotFoundException } from '@nestjs/common'
import { and, asc, eq, isNull, ne } from 'drizzle-orm'
import { users } from '@symph-crm/database'
import { CrmUserRole, CrmUserStatus } from '@symph-crm/shared'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { PartnerGroupsService } from '../partner-groups/partner-groups.service'
import { PartnerDealGroupsService } from '../partner-deal-groups/partner-deal-groups.service'

type UserRole = CrmUserRole
type UserStatus = CrmUserStatus

// Emails that are auto-assigned the SALES role on sign-in.
// Non-Symph emails enter a pending PARTNER flow for Sales review.
const DEFAULT_SALES_EMAILS = [
  'mary.amora@symph.co',
  'gee@symph.co',
  'gee.quidet@symph.co',
  'chelle@symph.co',
  'chelle.gray@symph.co',
  'lyra.gemparo@symph.co',
  'kate.labra@symph.co',
  'frances@symph.co',
  'jarrhey@symph.co',
  'vince.tapdasan@symph.co',
  'xian.baylin@symph.co',
  'ferlie@symph.co',
  'dave@symph.co',
] as const

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function parseEmailList(value: string | undefined) {
  return (value ?? '')
    .split(/[;,]/)
    .map(email => normalizeEmail(email))
    .filter(Boolean)
}

function getSalesEmails() {
  return new Set([...DEFAULT_SALES_EMAILS, ...parseEmailList(process.env.SALES_EMAILS)])
}

function getInternalEmailDomains() {
  return (process.env.INTERNAL_EMAIL_DOMAINS ?? 'symph.co')
    .split(',')
    .map(domain => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

function isInternalEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  return getInternalEmailDomains().some(domain => normalizedEmail.endsWith(`@${domain}`))
}

function roleForEmail(email: string): UserRole {
  const normalizedEmail = normalizeEmail(email)
  if (getSalesEmails().has(normalizedEmail)) return CrmUserRole.Sales
  if (isInternalEmail(normalizedEmail)) return CrmUserRole.Build
  return CrmUserRole.Partner
}

function statusForEmail(email: string): UserStatus {
  return isInternalEmail(email) ? CrmUserStatus.Active : CrmUserStatus.Pending
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
    private partnerGroups: PartnerGroupsService,
    private partnerDealGroups: PartnerDealGroupsService,
  ) {}

  async sync(data: { id: string; email: string; name?: string | null; image?: string | null }) {
    const email = normalizeEmail(data.email)
    const incomingRole = roleForEmail(email)
    const incomingStatus = statusForEmail(email)

    const [existing] = await this.db.select().from(users).where(eq(users.email, email)).limit(1)

    if (existing) {
      const isInternal = isInternalEmail(email)
      const isRemovedOrRejected = existing.status === CrmUserStatus.Rejected || !!existing.deletedAt || !existing.isActive
      const isApprovedExternal = !isInternal && !isRemovedOrRejected && existing.role === CrmUserRole.Partner && existing.status === CrmUserStatus.Active
      const role = isInternal ? incomingRole : CrmUserRole.Partner
      const status = isRemovedOrRejected
        ? CrmUserStatus.Rejected
        : isInternal || isApprovedExternal
          ? CrmUserStatus.Active
          : CrmUserStatus.Pending
      const [updated] = await this.db
        .update(users)
        .set({
          name: data.name ?? null,
          image: data.image ?? null,
          role,
          status,
          isActive: status === CrmUserStatus.Active || status === CrmUserStatus.Pending,
          isOnboarded: isInternal ? existing.isOnboarded : isApprovedExternal,
          currentTeam: isInternal ? existing.currentTeam : null,
          deletedAt: status === CrmUserStatus.Pending ? null : existing.deletedAt,
          updatedAt: new Date(),
        })
        .where(eq(users.email, email))
        .returning()
      return updated
    }

    const [user] = await this.db
      .insert(users)
      .values({
        id: data.id,
        email,
        name: data.name ?? null,
        image: data.image ?? null,
        role: incomingRole,
        status: incomingStatus,
        isActive: incomingStatus !== CrmUserStatus.Rejected,
      })
      .returning()

    this.auditLogs.log({
      action: 'create',
      auditType: 'user_synced',
      entityType: 'user',
      entityId: user.id,
      performedBy: user.id,
      details: {
        email,
        role: user.role,
        status: user.status,
      },
    }).catch(() => {})

    return user
  }

  async completeOnboarding(
    id: string,
    data: {
      currentTeam: string
    },
  ) {
    const [user] = await this.db
      .update(users)
      .set({
        currentTeam: data.currentTeam,
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
        currentTeam: data.currentTeam,
      },
    }).catch(() => {})

    return user
  }

  async findOne(id: string) {
    const [user] = await this.db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt)))
    return user ?? null
  }

  async findSessionUser(id: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        status: users.status,
        isActive: users.isActive,
        isOnboarded: users.isOnboarded,
        currentTeam: users.currentTeam,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1)
    return user ?? null
  }

  async findByDiscordId(discordId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.discordId, discordId), isNull(users.deletedAt)))
      .limit(1)
    return user ?? null
  }

  async linkDiscordId(id: string, discordId: string) {
    const [user] = await this.db
      .update(users)
      .set({ discordId, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    this.auditLogs.log({
      action: 'update',
      auditType: 'user_discord_linked',
      entityType: 'user',
      entityId: id,
      performedBy: id,
      details: { discordId },
    }).catch(() => {})

    return user
  }

  async findAll() {
    return this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        status: users.status,
        isActive: users.isActive,
        isOnboarded: users.isOnboarded,
        firstName: users.firstName,
        lastName: users.lastName,
        nickname: users.nickname,
        discordId: users.discordId,
      })
      .from(users)
      .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
      .orderBy(asc(users.name))
  }

  async findExternalUsers() {
    return this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        status: users.status,
        isActive: users.isActive,
        isOnboarded: users.isOnboarded,
        firstName: users.firstName,
        lastName: users.lastName,
        nickname: users.nickname,
        discordId: users.discordId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(ne(users.email, ''), isNull(users.deletedAt), eq(users.isActive, true)))
      .orderBy(asc(users.createdAt))
      .then(rows => rows.filter(user => user.email ? !isInternalEmail(user.email) : false))
  }

  async approveExternalUser(id: string, performedBy?: string, partnerGroupIds: string[] = [], partnerDealGroupIds: string[] = []) {
    const user = await this.findOne(id)
    if (!user) throw new NotFoundException('User not found')
    const email = user.email ?? ''
    if (isInternalEmail(email)) throw new BadRequestException('Internal users do not need external approval')

    const [updated] = await this.db
      .update(users)
      .set({ role: CrmUserRole.Partner, status: CrmUserStatus.Active, isActive: true, isOnboarded: true, deletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    if (partnerGroupIds.length > 0) {
      await this.partnerGroups.addUserToGroups(id, partnerGroupIds, performedBy)
    }
    if (partnerDealGroupIds.length > 0) {
      await this.partnerDealGroups.addUserToGroups(id, partnerDealGroupIds, performedBy)
    }

    await this.logExternalUserChange('user_external_approved', id, performedBy, {
      email,
      previousStatus: user.status,
      status: updated.status,
      partnerGroupIds,
      partnerDealGroupIds,
    })

    return updated
  }

  async rejectExternalUser(id: string, performedBy?: string) {
    const user = await this.findOne(id)
    if (!user) throw new NotFoundException('User not found')
    const email = user.email ?? ''
    if (isInternalEmail(email)) throw new BadRequestException('Internal users cannot be rejected here')

    const [updated] = await this.db
      .update(users)
      .set({ status: CrmUserStatus.Rejected, isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    await this.logExternalUserChange('user_external_rejected', id, performedBy, {
      email,
      previousStatus: user.status,
      status: updated.status,
    })

    return updated
  }

  async updateExternalUserRole(id: string, role: UserRole, performedBy?: string) {
    const user = await this.findOne(id)
    if (!user) throw new NotFoundException('User not found')
    const email = user.email ?? ''
    if (isInternalEmail(email)) throw new BadRequestException('Internal user roles are managed by the internal allowlist')
    if (role !== CrmUserRole.Partner) throw new BadRequestException('External users can only be PARTNER')

    const [updated] = await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    await this.logExternalUserChange('user_external_role_updated', id, performedBy, {
      email,
      previousRole: user.role,
      role: updated.role,
    })

    return updated
  }

  async removeExternalUser(id: string, performedBy?: string) {
    const user = await this.findOne(id)
    if (!user) throw new NotFoundException('User not found')
    const email = user.email ?? ''
    if (isInternalEmail(email)) throw new BadRequestException('Internal users cannot be removed here')

    const [updated] = await this.db
      .update(users)
      .set({ status: CrmUserStatus.Rejected, isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    await this.logExternalUserChange('user_external_removed', id, performedBy, {
      email,
      previousStatus: user.status,
    })

    return updated
  }

  private async logExternalUserChange(auditType: string, entityId: string, performedBy: string | undefined, details: Record<string, unknown>) {
    await this.auditLogs.log({
      action: 'update',
      auditType,
      entityType: 'user',
      entityId,
      performedBy,
      details,
    }).catch(() => {})
  }
}
