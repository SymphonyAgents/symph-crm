import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { followUpReminders } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type FollowUpReminderStatus = 'pending' | 'completed' | 'snoozed' | 'cancelled'

@Injectable()
export class FollowUpRemindersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(params?: {
    status?: FollowUpReminderStatus
    dealId?: string
    emailThreadId?: string
    from?: string
    to?: string
    limit?: number
  }) {
    const conditions = []
    if (params?.status) conditions.push(eq(followUpReminders.status, params.status))
    if (params?.dealId) conditions.push(eq(followUpReminders.dealId, params.dealId))
    if (params?.emailThreadId) conditions.push(eq(followUpReminders.emailThreadId, params.emailThreadId))
    if (params?.from) conditions.push(gte(followUpReminders.remindAt, new Date(params.from)))
    if (params?.to) conditions.push(lte(followUpReminders.remindAt, new Date(params.to)))

    const limit = Math.max(1, Math.min(params?.limit ?? 100, 500))
    const base = this.db.select().from(followUpReminders)
    return conditions.length > 0
      ? base.where(and(...conditions)).orderBy(desc(followUpReminders.remindAt)).limit(limit)
      : base.orderBy(desc(followUpReminders.remindAt)).limit(limit)
  }

  async upsert(params: typeof followUpReminders.$inferInsert) {
    const [reminder] = await this.db
      .insert(followUpReminders)
      .values({ ...params, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: followUpReminders.idempotencyKey,
        set: {
          dealId: params.dealId,
          emailThreadId: params.emailThreadId,
          assignedTo: params.assignedTo,
          remindAt: params.remindAt,
          reason: params.reason,
          status: params.status ?? 'pending',
          updatedAt: new Date(),
        },
      })
      .returning()
    return reminder
  }

  async complete(id: string) {
    const [reminder] = await this.db
      .update(followUpReminders)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(followUpReminders.id, id))
      .returning()

    if (!reminder) throw new NotFoundException(`Follow-up reminder ${id} not found`)
    return reminder
  }

  async snooze(id: string, remindAt: string) {
    const parsed = new Date(remindAt)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid remindAt value')

    const [existing] = await this.db.select().from(followUpReminders).where(eq(followUpReminders.id, id)).limit(1)
    if (!existing) throw new NotFoundException(`Follow-up reminder ${id} not found`)

    const [reminder] = await this.db
      .update(followUpReminders)
      .set({ status: 'snoozed', snoozedFrom: existing.remindAt, remindAt: parsed, updatedAt: new Date() })
      .where(eq(followUpReminders.id, id))
      .returning()

    return reminder
  }
}
