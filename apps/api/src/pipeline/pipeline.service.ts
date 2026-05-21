import { Injectable, Inject } from '@nestjs/common'
import { sql } from 'drizzle-orm'
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

export type PipelineSummaryParams = {
  from?: string
  to?: string
}

export type FunnelStage = {
  stage: string
  label: string
  entryCount: number
  conversionRate: number | null   // % conversion to next funnel stage; null for last funnel stage
  isBottleneck: boolean           // conversionRate !== null && conversionRate < 40
  color: string
  sortOrder: number
}

export type FunnelResponse = {
  stages: FunnelStage[]   // active (non-terminal) pipeline stages, ordered by sort_order
  totalEntered: number    // entryCount of the first stage (0 if no stages)
  wonCount: number        // unique deals that ever reached closed_won
  lostCount: number       // unique deals that ever reached closed_lost
}

@Injectable()
export class PipelineService {
  constructor(@Inject(DB) private db: Database) {}

  async getSummary(params: PipelineSummaryParams = {}): Promise<PipelineSummary> {
    const from = params.from ?? null
    const to = params.to ?? null

    // Stage grouping query — JOIN pipeline_stages to resolve slug from stage_id
    let stageQuery
    if (from && to) {
      stageQuery = this.db.execute(sql`
        SELECT ps.slug AS stage, COUNT(*)::int AS count, COALESCE(SUM(d.value), 0)::float8 AS total_value
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.deleted_at IS NULL AND d.created_at >= ${from}::timestamptz AND d.created_at <= ${to}::timestamptz
        GROUP BY ps.slug
      `)
    } else if (from) {
      stageQuery = this.db.execute(sql`
        SELECT ps.slug AS stage, COUNT(*)::int AS count, COALESCE(SUM(d.value), 0)::float8 AS total_value
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.deleted_at IS NULL AND d.created_at >= ${from}::timestamptz
        GROUP BY ps.slug
      `)
    } else if (to) {
      stageQuery = this.db.execute(sql`
        SELECT ps.slug AS stage, COUNT(*)::int AS count, COALESCE(SUM(d.value), 0)::float8 AS total_value
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.deleted_at IS NULL AND d.created_at <= ${to}::timestamptz
        GROUP BY ps.slug
      `)
    } else {
      stageQuery = this.db.execute(sql`
        SELECT ps.slug AS stage, COUNT(*)::int AS count, COALESCE(SUM(d.value), 0)::float8 AS total_value
        FROM deals d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        WHERE d.deleted_at IS NULL
        GROUP BY ps.slug
      `)
    }
    const rows = await stageQuery

    type Row = { stage: string; count: number; total_value: number }
    const byStage = (rows as unknown as Row[]).map(r => ({
      stage: r.stage ?? 'unknown',
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

    // Value query — with optional date filter
    let valueQuery
    if (from && to) {
      valueQuery = this.db.execute(sql`SELECT value AS v FROM deals WHERE deleted_at IS NULL AND value IS NOT NULL AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz`)
    } else if (from) {
      valueQuery = this.db.execute(sql`SELECT value AS v FROM deals WHERE deleted_at IS NULL AND value IS NOT NULL AND created_at >= ${from}::timestamptz`)
    } else if (to) {
      valueQuery = this.db.execute(sql`SELECT value AS v FROM deals WHERE deleted_at IS NULL AND value IS NOT NULL AND created_at <= ${to}::timestamptz`)
    } else {
      valueQuery = this.db.execute(sql`SELECT value AS v FROM deals WHERE deleted_at IS NULL AND value IS NOT NULL`)
    }
    const valueRows = await valueQuery

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

  async getFunnel(params: PipelineSummaryParams = {}): Promise<FunnelResponse> {
    const from = params.from ?? null
    const to = params.to ?? null

    const auditFilter =
      from && to ? sql`AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz`
      : from      ? sql`AND created_at >= ${from}::timestamptz`
      : to        ? sql`AND created_at <= ${to}::timestamptz`
      : sql``

    const dealFilter =
      from && to ? sql`AND d.created_at >= ${from}::timestamptz AND d.created_at <= ${to}::timestamptz`
      : from      ? sql`AND d.created_at >= ${from}::timestamptz`
      : to        ? sql`AND d.created_at <= ${to}::timestamptz`
      : sql``

    const [entryRows, transitionRows] = await Promise.all([
      this.db.execute(sql`
        WITH deal_created_entries AS (
          SELECT DISTINCT entity_id, 'lead' AS stage
          FROM audit_logs
          WHERE audit_type = 'deal_created' ${auditFilter}
        ),
        stage_change_entries AS (
          SELECT DISTINCT entity_id, details->>'to' AS stage
          FROM audit_logs
          WHERE audit_type = 'deal_stage_change'
            AND details->>'to' IS NOT NULL
            ${auditFilter}
        ),
        current_deal_stages AS (
          -- JOIN pipeline_stages to resolve slug from stage_id
          SELECT DISTINCT d.id::text AS entity_id, ps.slug AS stage
          FROM deals d
          LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
          WHERE ps.slug IS NOT NULL AND d.deleted_at IS NULL ${dealFilter}
        ),
        all_stage_entries AS (
          SELECT entity_id, stage FROM deal_created_entries
          UNION
          SELECT entity_id, stage FROM stage_change_entries
          UNION
          SELECT entity_id, stage FROM current_deal_stages
        ),
        stage_counts AS (
          SELECT stage, COUNT(DISTINCT entity_id)::int AS entry_count
          FROM all_stage_entries
          GROUP BY stage
        )
        SELECT
          ps.slug        AS stage,
          ps.label       AS label,
          ps.sort_order  AS sort_order,
          ps.color       AS color,
          COALESCE(sc.entry_count, 0)::int AS entry_count
        FROM pipeline_stages ps
        LEFT JOIN stage_counts sc ON sc.stage = ps.slug
        WHERE ps.is_active = true
        ORDER BY ps.sort_order
      `),

      this.db.execute(sql`
        SELECT
          details->>'from' AS from_stage,
          details->>'to'   AS to_stage,
          COUNT(DISTINCT entity_id)::int AS transition_count
        FROM audit_logs
        WHERE audit_type = 'deal_stage_change'
          AND details->>'from' IS NOT NULL
          AND details->>'to' IS NOT NULL
          ${auditFilter}
        GROUP BY details->>'from', details->>'to'
      `),
    ])

    type TransRow = { from_stage: string; to_stage: string; transition_count: number }
    const transitionMap = new Map<string, number>()
    for (const r of transitionRows as unknown as TransRow[]) {
      transitionMap.set(`${r.from_stage}->${r.to_stage}`, Number(r.transition_count))
    }

    type FunnelRow = { stage: string; label: string; sort_order: number; color: string; entry_count: number }
    const allRows = (entryRows as unknown as FunnelRow[]).map(r => ({
      stage: r.stage,
      label: r.label,
      sortOrder: Number(r.sort_order),
      color: r.color,
      entryCount: Number(r.entry_count),
    }))

    const TERMINAL = new Set(['closed_won', 'closed_lost'])
    const funnelRows = allRows.filter(r => !TERMINAL.has(r.stage))
    const wonRow = allRows.find(r => r.stage === 'closed_won')
    const lostRow = allRows.find(r => r.stage === 'closed_lost')

    const stages: FunnelStage[] = funnelRows.map((s, i) => {
      const next = funnelRows[i + 1]
      let conversionRate: number | null = null
      if (next != null && s.entryCount > 0) {
        const transitionCount = transitionMap.get(`${s.stage}->${next.stage}`) ?? 0
        conversionRate = Math.min(100, Math.round((transitionCount / s.entryCount) * 100))
      }
      const isBottleneck = conversionRate !== null && conversionRate < 40
      return {
        stage: s.stage,
        label: s.label,
        entryCount: s.entryCount,
        conversionRate,
        isBottleneck,
        color: s.color,
        sortOrder: s.sortOrder,
      }
    })

    return {
      stages,
      totalEntered: funnelRows[0]?.entryCount ?? 0,
      wonCount: wonRow?.entryCount ?? 0,
      lostCount: lostRow?.entryCount ?? 0,
    }
  }
}
