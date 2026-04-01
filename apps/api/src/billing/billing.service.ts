import { Injectable, Inject } from '@nestjs/common'
import { eq, and, asc } from 'drizzle-orm'
import { dealBilling, billingMilestones } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type UpsertBillingDto = {
  billingType: 'annual' | 'monthly' | 'milestone'
  contractStart?: string | null
  contractEnd?: string | null
  amount?: string | null
}

export type UpsertMilestoneDto = {
  name: string
  amount: string
  sortOrder?: number
  isPaid?: boolean
}

@Injectable()
export class BillingService {
  constructor(@Inject(DB) private db: Database) {}

  async getByDeal(dealId: string) {
    const [billing] = await this.db
      .select()
      .from(dealBilling)
      .where(eq(dealBilling.dealId, dealId))

    if (!billing) return null

    const milestones = await this.db
      .select()
      .from(billingMilestones)
      .where(eq(billingMilestones.billingId, billing.id))
      .orderBy(asc(billingMilestones.sortOrder))

    return { ...billing, milestones }
  }

  async upsertBilling(dealId: string, dto: UpsertBillingDto) {
    const monthlyDerived = this.calcMonthlyDerived(dto)

    const [existing] = await this.db
      .select()
      .from(dealBilling)
      .where(eq(dealBilling.dealId, dealId))

    if (existing) {
      const [updated] = await this.db
        .update(dealBilling)
        .set({
          billingType: dto.billingType,
          contractStart: dto.contractStart ?? null,
          contractEnd: dto.contractEnd ?? null,
          amount: dto.amount ?? null,
          monthlyDerived,
          updatedAt: new Date(),
        })
        .where(eq(dealBilling.id, existing.id))
        .returning()
      return updated
    }

    const [created] = await this.db
      .insert(dealBilling)
      .values({
        dealId,
        billingType: dto.billingType,
        contractStart: dto.contractStart ?? null,
        contractEnd: dto.contractEnd ?? null,
        amount: dto.amount ?? null,
        monthlyDerived,
      })
      .returning()
    return created
  }

  async addMilestone(billingId: string, dto: UpsertMilestoneDto) {
    const [milestone] = await this.db
      .insert(billingMilestones)
      .values({
        billingId,
        name: dto.name,
        amount: dto.amount,
        sortOrder: dto.sortOrder ?? 0,
        isPaid: dto.isPaid ?? false,
      })
      .returning()

    await this.recalcMilestonePercentages(billingId)
    return milestone
  }

  async updateMilestone(milestoneId: string, dto: Partial<UpsertMilestoneDto>) {
    const [milestone] = await this.db
      .update(billingMilestones)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid, paidAt: dto.isPaid ? new Date() : null } : {}),
      })
      .where(eq(billingMilestones.id, milestoneId))
      .returning()

    if (milestone) {
      await this.recalcMilestonePercentages(milestone.billingId)
    }
    return milestone
  }

  async deleteMilestone(milestoneId: string) {
    const [deleted] = await this.db
      .delete(billingMilestones)
      .where(eq(billingMilestones.id, milestoneId))
      .returning()

    if (deleted) {
      await this.recalcMilestonePercentages(deleted.billingId)
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private calcMonthlyDerived(dto: UpsertBillingDto): string | null {
    if (!dto.amount) return null
    const amt = parseFloat(dto.amount)
    if (isNaN(amt)) return null

    switch (dto.billingType) {
      case 'annual':
        return (amt / 12).toFixed(2)
      case 'monthly':
        return amt.toFixed(2)
      case 'milestone':
        return null // derived from milestones after they're set
      default:
        return null
    }
  }

  private async recalcMilestonePercentages(billingId: string) {
    const milestones = await this.db
      .select()
      .from(billingMilestones)
      .where(eq(billingMilestones.billingId, billingId))

    const total = milestones.reduce((sum, m) => sum + parseFloat(m.amount || '0'), 0)

    for (const m of milestones) {
      const pct = total > 0 ? ((parseFloat(m.amount || '0') / total) * 100).toFixed(2) : '0'
      await this.db
        .update(billingMilestones)
        .set({ percentage: pct })
        .where(eq(billingMilestones.id, m.id))
    }

    // Also update the billing record's monthlyDerived based on milestone sum + contract duration
    const [billing] = await this.db
      .select()
      .from(dealBilling)
      .where(eq(dealBilling.id, billingId))

    if (billing && billing.contractStart && billing.contractEnd) {
      const start = new Date(billing.contractStart)
      const end = new Date(billing.contractEnd)
      const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()))
      const monthly = total / months
      await this.db
        .update(dealBilling)
        .set({ amount: total.toFixed(2), monthlyDerived: monthly.toFixed(2), updatedAt: new Date() })
        .where(eq(dealBilling.id, billingId))
    } else if (billing) {
      await this.db
        .update(dealBilling)
        .set({ amount: total.toFixed(2), updatedAt: new Date() })
        .where(eq(dealBilling.id, billingId))
    }
  }
}
