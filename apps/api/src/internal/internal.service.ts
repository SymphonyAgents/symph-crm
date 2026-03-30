import { Injectable, Inject, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type SweepResult = {
  dormantFlagged: number
  dealIds: string[]
}

export type PipelineStageSummary = {
  stage: string
  count: number
  totalValue: number
}

export type PipelineSummary = {
  stages: PipelineStageSummary[]
  totalDeals: number
  totalPipelineValue: number
  flaggedDeals: number
}

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name)

  constructor(@Inject(DB) private db: Database) {}

  /**
   * Dormancy sweep — flags all deals that have had no activity within the
   * workspace's configured threshold (default: 3 days).
   *
   * Single bulk UPDATE regardless of deal count — O(1) infrastructure.
   * Triggered by Cloud Scheduler daily at 8am PHT (midnight UTC).
   */
  async sweepDormantDeals(): Promise<SweepResult> {
    const result = await this.db.execute(sql`
      UPDATE deals d
      SET
        is_flagged  = true,
        flag_reason = 'dormant',
        updated_at  = now()
      FROM workspaces w
      WHERE d.workspace_id = w.id
        AND d.stage NOT IN ('closed_won', 'closed_lost')
        AND d.last_activity_at < now() - (
          COALESCE((w.settings->>'dormancy_threshold_days')::int, 3) * INTERVAL '1 day'
        )
        AND d.is_flagged = false
      RETURNING d.id, d.title, d.assigned_to
    `)

    const rows = Array.from(result) as Array<{ id: string; title: string; assigned_to: string | null }>
    const dealIds = rows.map((r) => r.id)

    if (dealIds.length > 0) {
      this.logger.log(`Dormancy sweep: flagged ${dealIds.length} deals — ${dealIds.join(', ')}`)
    } else {
      this.logger.log('Dormancy sweep: no dormant deals found')
    }

    return { dormantFlagged: dealIds.length, dealIds }
  }

  /**
   * Unflag a deal when activity resumes.
   * Called by DealsService.updateLastActivity() — keeps flag state consistent.
   */
  async unflagDeal(dealId: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE deals
      SET is_flagged  = false,
          flag_reason = null,
          updated_at  = now()
      WHERE id = ${dealId}
        AND is_flagged = true
    `)
  }

  /**
   * Pipeline summary — deal counts and values grouped by stage.
   * Used by Aria to get a high-level view of the CRM without paginating every deal.
   */
  async getPipelineSummary(): Promise<PipelineSummary> {
    const rows = await this.db.execute(sql`
      SELECT
        stage,
        COUNT(*)::int                                         AS count,
        COALESCE(SUM(value), 0)::float                       AS total_value
      FROM deals
      WHERE stage NOT IN ('closed_won', 'closed_lost')
      GROUP BY stage
      ORDER BY
        CASE stage
          WHEN 'lead'        THEN 1
          WHEN 'qualified'   THEN 2
          WHEN 'proposal'    THEN 3
          WHEN 'negotiation' THEN 4
          ELSE 5
        END
    `)

    const stages = Array.from(rows) as Array<{ stage: string; count: number; total_value: number }>

    const totalDeals = stages.reduce((sum, r) => sum + r.count, 0)
    const totalPipelineValue = stages.reduce((sum, r) => sum + r.total_value, 0)

    const [flaggedRow] = await this.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM deals WHERE is_flagged = true
    `)
    const flaggedDeals = (flaggedRow as any)?.count ?? 0

    return {
      stages: stages.map((r) => ({
        stage: r.stage,
        count: r.count,
        totalValue: r.total_value,
      })),
      totalDeals,
      totalPipelineValue,
      flaggedDeals,
    }
  }
}
