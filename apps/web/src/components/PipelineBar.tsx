'use client'

type ApiDealBrief = {
  id: string
  stage: string
  value: string | null
}

type PipelineBarProps = {
  deals: ApiDealBrief[]
}

const PIPELINE_STAGES = [
  { id: 'lead',          label: 'Lead',        color: '#94a3b8' },
  { id: 'discovery',     label: 'Discovery',   color: '#2563eb' },
  { id: 'assessment',    label: 'Assessment',  color: '#7c3aed' },
  { id: 'qualified',     label: 'Qualified',   color: '#0369a1' },
  { id: 'demo',          label: 'Demo',        color: '#d97706' },
  { id: 'proposal',      label: 'Proposal',    color: '#d97706' },
  { id: 'proposal_demo', label: 'Demo+Prop',   color: '#d97706' },
  { id: 'negotiation',   label: 'Negotiation', color: '#f59e0b' },
  { id: 'followup',      label: 'Follow-up',   color: '#f59e0b' },
  { id: 'closed_won',    label: 'Won',         color: '#16a34a' },
  { id: 'closed_lost',   label: 'Lost',        color: '#dc2626' },
]

export function PipelineBar({ deals }: PipelineBarProps) {
  const stageData = PIPELINE_STAGES.map(s => ({
    ...s,
    count: deals.filter(d => d.stage === s.id).length,
    value: deals
      .filter(d => d.stage === s.id)
      .reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0),
  }))

  const maxValue = Math.max(...stageData.map(s => s.value), 1)

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)` }}>
      {stageData.map(s => {
        const fillPct = maxValue > 0 ? Math.max(0, Math.round((s.value / maxValue) * 100)) : 0
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
                className="h-full rounded-full"
                style={{
                  width: `${fillPct}%`,
                  background: hasDeals ? s.color : '#cbd5e1',
                }}
              />
            </div>
            <div className="text-[15px] font-bold text-slate-900 tabular-nums">{s.count}</div>
          </div>
        )
      })}
    </div>
  )
}
