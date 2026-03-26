'use client'

type ApiDealBrief = {
  id: string
  stage: string
  value: string | null
}

type PipelineBarProps = {
  deals: ApiDealBrief[]
}

/**
 * 7 consolidated stages — matches the dashboard design reference.
 * Granular stages (qualified, demo, proposal, proposal_demo, negotiation) are
 * grouped into their parent buckets to avoid a cluttered 11-column grid.
 */
const SUMMARY_STAGES = [
  {
    id: 'lead',
    label: 'Lead',
    color: '#94a3b8',
    matches: ['lead'],
  },
  {
    id: 'discovery',
    label: 'Discovery',
    color: '#2563eb',
    matches: ['discovery'],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    color: '#7c3aed',
    matches: ['assessment', 'qualified'],
  },
  {
    id: 'demo_proposal',
    label: 'Demo + Proposal',
    color: '#d97706',
    matches: ['demo', 'proposal', 'proposal_demo'],
  },
  {
    id: 'followup',
    label: 'Follow-up',
    color: '#f59e0b',
    matches: ['negotiation', 'followup'],
  },
  {
    id: 'won',
    label: 'Won',
    color: '#16a34a',
    matches: ['closed_won'],
  },
  {
    id: 'lost',
    label: 'Lost',
    color: '#dc2626',
    matches: ['closed_lost'],
  },
]

export function PipelineBar({ deals }: PipelineBarProps) {
  const stageData = SUMMARY_STAGES.map(s => ({
    ...s,
    count: deals.filter(d => s.matches.includes(d.stage)).length,
  }))

  const maxCount = Math.max(...stageData.map(s => s.count), 1)

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${SUMMARY_STAGES.length}, 1fr)` }}>
      {stageData.map(s => {
        const fillPct = Math.round((s.count / maxCount) * 100)
        const hasDeals = s.count > 0

        return (
          <div key={s.id} className="flex flex-col gap-1.5 min-w-0">
            <div
              className="text-[11px] font-medium truncate"
              style={{ color: hasDeals ? s.color : '#94a3b8' }}
            >
              {s.label}
            </div>
            <div className="h-[6px] bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: hasDeals ? `${fillPct}%` : '0%',
                  background: s.color,
                  opacity: hasDeals ? 1 : 0,
                }}
              />
            </div>
            <div className="text-[15px] font-bold tabular-nums" style={{ color: hasDeals ? '#0f172a' : '#94a3b8' }}>
              {s.count}
            </div>
          </div>
        )
      })}
    </div>
  )
}
