import { Injectable, Inject } from '@nestjs/common'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { notifications, deals, companies } from '@symph-crm/database'
import { eq, and, lt, sql } from 'drizzle-orm'

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private db: Database) {}

  async getForUser(userId: string) {
    // 1. Upsert dormant deal notifications (deals with no activity for > 3 days)
    const dormantDeals = await this.db
      .select({ id: deals.id, title: deals.title, companyId: deals.companyId })
      .from(deals)
      .where(
        and(
          eq(deals.assignedTo, userId),
          lt(deals.lastActivityAt, sql`NOW() - INTERVAL '3 days'`),
          sql`COALESCE((SELECT slug FROM pipeline_stages WHERE id = ${deals.stageId}), '') NOT IN ('closed_won', 'closed_lost')`,
        ),
      )

    // Upsert: create notification if not already exists for this deal
    for (const deal of dormantDeals) {
      const existing = await this.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, 'dormant_deal'),
            eq(notifications.dealId, deal.id),
            eq(notifications.isRead, false),
          ),
        )
        .limit(1)

      if (existing.length === 0) {
        await this.db.insert(notifications).values({
          userId,
          type: 'dormant_deal',
          dealId: deal.id,
          metadata: { dealTitle: deal.title },
        })
      }
    }

    // 2. Fetch all notifications for user with deal + company join
    const rows = await this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        dealId: notifications.dealId,
        metadata: notifications.metadata,
        dealTitle: deals.title,
        companyId: deals.companyId,
      })
      .from(notifications)
      .leftJoin(deals, eq(notifications.dealId, deals.id))
      .where(eq(notifications.userId, userId))
      .orderBy(sql`${notifications.isRead} ASC, ${notifications.createdAt} DESC`)
      .limit(50)

    // 3. Fetch company names for the deals
    const companyIds = [...new Set(rows.map(r => r.companyId).filter(Boolean))] as string[]
    const companiesData = companyIds.length > 0
      ? await this.db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(sql`${companies.id} = ANY(${companyIds})`)
      : []
    const companyMap = new Map(companiesData.map(c => [c.id, c.name]))

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      isRead: row.isRead,
      createdAt: row.createdAt,
      dealId: row.dealId,
      dealTitle: row.dealTitle ?? (row.metadata as Record<string, unknown>)?.dealTitle ?? null,
      brandName: row.companyId ? (companyMap.get(row.companyId) ?? null) : null,
      triggerText: this.getTriggerText(row.type as string),
    }))
  }

  private getTriggerText(type: string): string {
    switch (type) {
      case 'dormant_deal': return 'No activity in 3+ days'
      case 'deal_won': return 'Deal marked as won'
      case 'mention': return 'You were mentioned'
      default: return ''
    }
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId))
  }

  async markOneRead(id: string, userId: string) {
    await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
  }

  // Called from DealsService when stage → closed_won
  async createDealWonNotification(userId: string, dealId: string, dealTitle: string) {
    const existing = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, 'deal_won'),
          eq(notifications.dealId, dealId),
        ),
      )
      .limit(1)

    if (existing.length === 0) {
      await this.db.insert(notifications).values({
        userId,
        type: 'deal_won',
        dealId,
        metadata: { dealTitle },
      })
    }
  }
}
