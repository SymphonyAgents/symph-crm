import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { CrmUserRole, CrmUserStatus } from '@symph-crm/shared'
import { dealPartnerGroups, deals, partnerGroupMembers, partnerGroups, users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

export type CreatePartnerGroupDto = {
  name: string
  slug?: string
  description?: string | null
  workspaceId?: string | null
  memberUserIds?: string[]
}

export type UpdatePartnerGroupDto = {
  name?: string
  slug?: string
  description?: string | null
  isActive?: boolean
  memberUserIds?: string[]
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new BadRequestException(`${fieldName} must be an array of ids`)
  }
  return [...new Set(value)]
}

@Injectable()
export class PartnerGroupsService {
  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
  ) {}

  async findAll() {
    const rows = await this.db
      .select({
        group: partnerGroups,
        memberUserId: partnerGroupMembers.userId,
        memberName: users.name,
        memberEmail: users.email,
      })
      .from(partnerGroups)
      .leftJoin(partnerGroupMembers, eq(partnerGroupMembers.groupId, partnerGroups.id))
      .leftJoin(users, eq(users.id, partnerGroupMembers.userId))
      .orderBy(asc(partnerGroups.name))

    const byId = new Map<string, typeof partnerGroups.$inferSelect & { members: { id: string; name: string | null; email: string | null }[] }>()
    for (const row of rows) {
      const existing = byId.get(row.group.id) ?? { ...row.group, members: [] }
      if (row.memberUserId) {
        existing.members.push({ id: row.memberUserId, name: row.memberName, email: row.memberEmail })
      }
      byId.set(row.group.id, existing)
    }
    return [...byId.values()]
  }

  async create(dto: CreatePartnerGroupDto, performedBy?: string) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestException('name is required')
    const slug = normalizeSlug(dto.slug ?? name)
    if (!slug) throw new BadRequestException('slug is required')
    const memberUserIds = normalizeStringArray(dto.memberUserIds, 'memberUserIds') ?? []

    const [group] = await this.db.insert(partnerGroups).values({
      name,
      slug,
      description: dto.description ?? null,
      workspaceId: dto.workspaceId ?? null,
      createdBy: performedBy ?? null,
    }).returning()

    if (memberUserIds.length > 0) {
      await this.replaceMembers(group.id, memberUserIds, performedBy, group.workspaceId)
    }

    this.auditLogs.log({
      action: 'create',
      auditType: 'partner_group_created',
      entityType: 'partner_group',
      entityId: group.id,
      performedBy,
      details: { name, slug, memberCount: memberUserIds.length },
    }).catch(() => {})

    return this.findOne(group.id)
  }

  async update(id: string, dto: UpdatePartnerGroupDto, performedBy?: string) {
    const existing = await this.findOne(id)
    if (!existing) throw new NotFoundException('Partner group not found')
    const memberUserIds = normalizeStringArray(dto.memberUserIds, 'memberUserIds')

    const updates: Partial<typeof partnerGroups.$inferInsert> = { updatedAt: new Date() }
    if (dto.name !== undefined) {
      const name = dto.name.trim()
      if (!name) throw new BadRequestException('name is required')
      updates.name = name
    }
    if (dto.slug !== undefined) {
      const slug = normalizeSlug(dto.slug)
      if (!slug) throw new BadRequestException('slug is required')
      updates.slug = slug
    }
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.isActive !== undefined) updates.isActive = dto.isActive

    await this.db.update(partnerGroups).set(updates).where(eq(partnerGroups.id, id))
    if (memberUserIds) await this.replaceMembers(id, memberUserIds, performedBy, existing.workspaceId)

    this.auditLogs.log({
      action: 'update',
      auditType: 'partner_group_updated',
      entityType: 'partner_group',
      entityId: id,
      performedBy,
      details: { fields: Object.keys(dto) },
    }).catch(() => {})

    return this.findOne(id)
  }

  async remove(id: string, performedBy?: string) {
    const existing = await this.findOne(id)
    if (!existing) throw new NotFoundException('Partner group not found')
    await this.db.update(partnerGroups).set({ isActive: false, updatedAt: new Date() }).where(eq(partnerGroups.id, id))
    this.auditLogs.log({
      action: 'delete',
      auditType: 'partner_group_deactivated',
      entityType: 'partner_group',
      entityId: id,
      performedBy,
      details: { name: existing.name },
    }).catch(() => {})
    return { id }
  }

  async findOne(id: string) {
    const rows = await this.db
      .select({
        group: partnerGroups,
        memberUserId: partnerGroupMembers.userId,
        memberName: users.name,
        memberEmail: users.email,
      })
      .from(partnerGroups)
      .leftJoin(partnerGroupMembers, eq(partnerGroupMembers.groupId, partnerGroups.id))
      .leftJoin(users, eq(users.id, partnerGroupMembers.userId))
      .where(eq(partnerGroups.id, id))

    const first = rows[0]
    if (!first) return null
    return {
      ...first.group,
      members: rows
        .filter(row => row.memberUserId)
        .map(row => ({ id: row.memberUserId as string, name: row.memberName, email: row.memberEmail })),
    }
  }

  async replaceDealGroups(dealId: string, groupIds: string[], performedBy?: string) {
    const uniqueGroupIds = [...new Set(groupIds)]
    const [deal] = await this.db
      .select({ workspaceId: deals.workspaceId })
      .from(deals)
      .where(eq(deals.id, dealId))
      .limit(1)
    if (!deal) throw new NotFoundException('Deal not found')

    if (uniqueGroupIds.length > 0) {
      const groups = await this.db
        .select({ id: partnerGroups.id, workspaceId: partnerGroups.workspaceId })
        .from(partnerGroups)
        .where(and(inArray(partnerGroups.id, uniqueGroupIds as [string, ...string[]]), eq(partnerGroups.isActive, true)))
      const validIds = new Set(
        groups
          .filter(group => group.workspaceId === deal.workspaceId)
          .map(group => group.id),
      )
      const invalidIds = uniqueGroupIds.filter(id => !validIds.has(id))
      if (invalidIds.length > 0) throw new BadRequestException('partnerGroupIds must contain active partner groups in the deal workspace only')
    }

    await this.db.delete(dealPartnerGroups).where(eq(dealPartnerGroups.dealId, dealId))
    if (uniqueGroupIds.length === 0) return

    await this.db.insert(dealPartnerGroups).values(uniqueGroupIds.map(groupId => ({
      workspaceId: deal.workspaceId,
      dealId,
      groupId,
      createdBy: performedBy ?? null,
    })))
  }

  async addUserToGroups(userId: string, groupIds: string[], performedBy?: string) {
    const uniqueGroupIds = normalizeStringArray(groupIds, 'partnerGroupIds') ?? []
    if (uniqueGroupIds.length === 0) return

    const [partner] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.role, CrmUserRole.Partner),
        eq(users.status, CrmUserStatus.Active),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ))
      .limit(1)
    if (!partner) throw new BadRequestException('userId must be an active PARTNER user')

    const groupRows = await this.db
      .select({ id: partnerGroups.id, workspaceId: partnerGroups.workspaceId })
      .from(partnerGroups)
      .where(and(
        inArray(partnerGroups.id, uniqueGroupIds as [string, ...string[]]),
        eq(partnerGroups.isActive, true),
      ))
    const validGroupIds = new Set(groupRows.map(group => group.id))
    const invalidIds = uniqueGroupIds.filter(id => !validGroupIds.has(id))
    if (invalidIds.length > 0) throw new BadRequestException('partnerGroupIds must contain active partner groups only')

    await this.db.insert(partnerGroupMembers).values(groupRows.map(group => ({
      workspaceId: group.workspaceId ?? null,
      groupId: group.id,
      userId,
      createdBy: performedBy ?? null,
    }))).onConflictDoNothing()
  }

  private async replaceMembers(groupId: string, memberUserIds: string[], performedBy?: string, workspaceId?: string | null) {
    if (memberUserIds.length > 0) {
      const partnerRows = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(
          inArray(users.id, memberUserIds as [string, ...string[]]),
          eq(users.role, CrmUserRole.Partner),
          eq(users.status, CrmUserStatus.Active),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ))
      const validPartnerIds = new Set(partnerRows.map(user => user.id))
      const invalidIds = memberUserIds.filter(id => !validPartnerIds.has(id))
      if (invalidIds.length > 0) throw new BadRequestException('memberUserIds must contain active PARTNER users only')
    }

    await this.db.delete(partnerGroupMembers).where(eq(partnerGroupMembers.groupId, groupId))
    if (memberUserIds.length === 0) return

    await this.db.insert(partnerGroupMembers).values(memberUserIds.map(userId => ({
      workspaceId: workspaceId ?? null,
      groupId,
      userId,
      createdBy: performedBy ?? null,
    })))
  }
}
