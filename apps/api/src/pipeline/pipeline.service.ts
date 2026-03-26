import { Injectable, Inject } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { deals } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type PipelineSummary = {
  totalDeals: number
  activeDeals: number
  totalPipeline: number      // sum of value for non-closed deals
  avgDealSize: number        // avg value across all deals with a value
  winRate: number            // closed_won / (closed_won + closed_lost) as percentage 0-100
  dealsByStage: {
    stage: string
    count: number
    totalValue: number
  }[]
}

@Injectable()
export class PipelineService {
  constructor(@Inject(DB) private db: Database) {}

  async getSummary(): Promise<PipelineSummary> {
    // Single query: group by stage, count + sum value
    const rows = await this.db.execute(sql`
      SELECT
        stage,
        COUNT(*)::int                                         AS count,
        COALESCE(SUM(value::numeric), 0)::float8             AS total_value
      FROM deals
      GROUP BY stage
    `)

    type Row = { stage: string; count: number; total_value: number }
    const byStage = (rows as unknown as Row[]).map(r => ({
      stage: r.stage,
      count: Number(r.count),
      totalValue: Number(r.total_value),
    }))

    const CLOSED = new Set(['closed_won', 'closed_lost'])

    let totalDeals = 0
    let activeDeals = 0
    let totalPipeline = 0
    let closedWon = 0
    let closedLost = 0
    let sumAllValues = 0
    let dealsWithValue = 0

    // To get avgDealSize we need per-row value data — run a second lightweight query
    const valueRows = await this.db.execute(sql`
      SELECT value::numeric AS v FROM deals WHERE value IS NOT NULL
    `)
    type ValueRow = { v: string | null }
    for (const r of valueRows as unknown as ValueRow[]) {
      const n = parseFloat(r.v ?? '0')
      if (!isNaN(n) && n > 0) {
        sumAllValues += n
        dealsWithValue++
      }
    }

    for (const s of byStage) {
      totalDeals += s.count
      if (!CLOSED.has(s.stage)) {
        activeDeals += s.count
        totalPipeline += s.totalValue
      }
      if (s.stage === 'closed_won') closedWon = s.count
      if (s.stage === 'closed_lost') closedLost = s.count
    }

    const closedTotal = closedWon + closedLost
    const winRate = closedTotal > 0 ? Math.round((closedWon / closedTotal) * 100) : 0
    const avgDealSize = dealsWithValue > 0 ? Math.round(sumAllValues / dealsWithValue) : 0

    return {
      totalDeals,
      activeDeals,
      totalPipeline: Math.round(totalPipeline),
      avgDealSize,
      winRate,
      dealsByStage: byStage,
    }
  }
}
