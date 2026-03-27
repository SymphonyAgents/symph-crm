'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { getInitials } from '@/lib/utils'
import { Avatar } from './Avatar'
import { EmptyState } from './EmptyState'
import { CreateBrandModal } from './CreateBrandModal'
import { CreateDealModal } from './CreateDealModal'
import { DealsGraph } from './DealsGraph'

type ViewMode = 'list' | 'graph'

// --- API types (matching DB schema) ---

export type ApiCompany = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  website: string | null
  hqLocation: string | null
  logoUrl: string | null
  createdAt: string
}

export type ApiDeal = {
  id: string
  companyId: string
  title: string
  stage: string
  value: string | null
  servicesTags: string[] | null
  outreachCategory: string | null
  pricingModel: string | null
  assignedTo: string | null
  lastActivityAt: string | null
  createdAt: string
}

// --- Stage display config ---

const STAGE_DISPLAY: Record<string, { label: string; bg: string; color: string }> = {
  lead:          { label: 'Lead',            bg: '#f1f5f9',                 color: '#475569' },
  discovery:     { label: 'Discovery',       bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
  assessment:    { label: 'Assessment',      bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  qualified:     { label: 'Qualified',       bg: 'rgba(14,165,233,0.08)', color: '#0369a1' },
  demo:          { label: 'Demo',            bg: 'rgba(217,119,6,0.08)',  color: '#d97706' },
  proposal:      { label: 'Proposal',        bg: 'rgba(217,119,6,0.08)',  color: '#d97706' },
  proposal_demo: { label: 'Demo + Proposal', bg: 'rgba(217,119,6,0.08)', color: '#d97706' },
  negotiation:   { label: 'Negotiation',     bg: 'rgba(245,158,11,0.08)', color: '#92400e' },
  followup:      { label: 'Follow-up',       bg: 'rgba(245,158,11,0.08)', color: '#92400e' },
  closed_won:    { label: 'Won',             bg: 'rgba(22,163,74,0.08)',  color: '#16a34a' },
  closed_lost:   { label: 'Lost',            bg: 'rgba(220,38,38,0.08)', color: '#dc2626' },
}

const STAGE_DOT: Record<string, string> = {
  lead: '#94a3b8', discovery: '#2563eb', assessment: '#7c3aed',
  qualified: '#0369a1', demo: '#d97706', proposal: '#d97706',
  proposal_demo: '#d97706', negotiation: '#f59e0b', followup: '#f59e0b',
  closed_won: '#16a34a', closed_lost: '#dc2626',
}

const CLOSED_STAGES = new Set(['closed_won', 'closed_lost'])

// Deterministic brand color from name
const PALETTE = ['var(--primary)','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16']
function getBrandColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function formatValue(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  if (n >= 1_000_000) return 'P' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return 'P' + Math.round(n / 1_000) + 'K'
  return 'P' + new Intl.NumberFormat('en-PH').format(n)
}

function totalNumericValue(deals: ApiDeal[]): number {
  return deals.reduce((s, d) => {
    const n = parseFloat(d.value || '0')
    return s + (isNaN(n) ? 0 : n)
  }, 0)
}

// --- Sub-components ---

type BrandGroup = {
  company: ApiCompany
  color: string
  deals: ApiDeal[]
  totalValue: number
  activeCount: number
}

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_DISPLAY[stage] || { label: stage, bg: '#f1f5f9', color: '#475569' }
  return (
    <span
      className="inline-block px-2 py-px rounded-full text-[11px] font-medium leading-[18px] whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function BrandHeader({
  group, expanded, onToggle,
}: { group: BrandGroup; expanded: boolean; onToggle: () => void }) {
  const totalStr = group.totalValue > 0 ? formatValue(String(group.totalValue)) : '—'

  return (
    <button
      onClick={onToggle}
      className="grid grid-cols-[36px_1fr_auto_20px] sm:grid-cols-[40px_1fr_auto_auto_auto_20px] items-center gap-3 sm:gap-3.5 w-full px-4 sm:px-[18px] py-3.5 bg-white border-0 border-b border-black/[.06] cursor-pointer transition-colors text-left hover:bg-slate-50 active:scale-[0.998]"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-semibold shrink-0"
        style={{ background: `${group.color}15`, color: group.color }}
      >
        {getInitials(group.company.name)}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 truncate">
          {group.company.name}
        </div>
        <div className="text-[11px] text-slate-400 mt-px">
          {group.company.industry || group.company.domain || 'No industry set'}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1">
        <span className="text-[11px] font-medium text-slate-500">
          {group.deals.length} {group.deals.length === 1 ? 'deal' : 'deals'}
        </span>
        <span className="text-[10px] text-slate-400">
          ({group.activeCount} active)
        </span>
      </div>
      <div
        className="text-[13px] font-semibold tabular-nums sm:min-w-[90px] text-right"
        style={{ color: group.color }}
      >
        {totalStr}
      </div>
      <div className="hidden sm:flex gap-[3px] min-w-[56px] justify-end">
        {group.deals.map(d => (
          <div
            key={d.id}
            title={`${d.title} — ${d.stage}`}
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: STAGE_DOT[d.stage] || '#94a3b8' }}
          />
        ))}
      </div>
      <svg
        width={14} height={14} viewBox="0 0 24 24" fill="none"
        className="stroke-slate-400 transition-transform shrink-0"
        strokeWidth={1.2} strokeLinecap="round"
        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

function DealRow({
  deal, color, onClick,
}: { deal: ApiDeal; color: string; onClick: () => void }) {
  const tags = deal.servicesTags?.filter(Boolean) ?? []

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-[16px_1fr_auto_auto] sm:grid-cols-[40px_1.4fr_0.8fr_auto_0.5fr] items-center gap-3 sm:gap-3.5 py-3 pr-4 sm:pr-[18px] pl-5 sm:pl-8 border-b border-black/[.04] cursor-pointer transition-colors bg-white hover:bg-slate-50 active:scale-[0.998]"
    >
      <div className="flex items-center justify-center">
        <div
          className="w-1.5 h-1.5 rounded-full opacity-50 shrink-0"
          style={{ background: color }}
        />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
          {deal.title}
        </div>
        {tags.length > 0 && (
          <div className="flex gap-1 mt-px flex-wrap">
            {tags.slice(0, 3).map(s => (
              <span
                key={s}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-slate-500 whitespace-nowrap"
              >
                {s}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[9px] text-slate-400">+{tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
      <div className="hidden sm:block">
        <StagePill stage={deal.stage} />
      </div>
      <div className="text-[13px] font-medium text-slate-700 tabular-nums text-right whitespace-nowrap">
        {formatValue(deal.value)}
      </div>
      <div className="hidden sm:flex items-center justify-end">
        {deal.outreachCategory && (
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-[3px] capitalize whitespace-nowrap"
            style={{
              background: deal.outreachCategory === 'inbound' ? 'rgba(22,163,74,0.08)' : 'rgba(124,58,237,0.08)',
              color: deal.outreachCategory === 'inbound' ? '#16a34a' : '#7c3aed',
            }}
          >
            {deal.outreachCategory}
          </span>
        )}
      </div>
    </div>
  )
}

// --- Data fetching ---

async function fetchCompanies(): Promise<ApiCompany[]> {
  const res = await fetch('/api/companies')
  if (!res.ok) throw new Error('Failed to fetch companies')
  return res.json()
}

async function fetchDeals(): Promise<ApiDeal[]> {
  const res = await fetch('/api/deals')
  if (!res.ok) throw new Error('Failed to fetch deals')
  return res.json()
}

// --- Main component ---

type DealsProps = {
  onOpenDeal: (id: string) => void
}

export function Deals({ onOpenDeal }: DealsProps) {
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [showCreateDeal, setShowCreateDeal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const qc = useQueryClient()

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })

  const { data: deals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: fetchDeals,
  })

  const isLoading = loadingCompanies || loadingDeals

  const companyMap = useMemo(() => {
    const m = new Map<string, ApiCompany>()
    for (const c of companies) m.set(c.id, c)
    return m
  }, [companies])

  const groups: BrandGroup[] = useMemo(() => {
    const map = new Map<string, ApiDeal[]>()
    for (const d of deals) {
      const arr = map.get(d.companyId) || []
      arr.push(d)
      map.set(d.companyId, arr)
    }
    return Array.from(map.entries())
      .map(([companyId, cDeals]) => {
        const company = companyMap.get(companyId)
        if (!company) return null
        const totalValue = totalNumericValue(cDeals)
        return {
          company,
          color: getBrandColor(company.name),
          deals: cDeals,
          totalValue,
          activeCount: cDeals.filter(d => !CLOSED_STAGES.has(d.stage)).length,
        }
      })
      .filter((g): g is BrandGroup => g !== null)
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [deals, companyMap])

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map(g => ({
        ...g,
        deals: g.deals.filter(d =>
          d.title.toLowerCase().includes(q) ||
          g.company.name.toLowerCase().includes(q) ||
          d.stage.toLowerCase().includes(q) ||
          (d.servicesTags ?? []).some(s => s.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.deals.length > 0 || g.company.name.toLowerCase().includes(q))
  }, [groups, search])

  function toggleBrand(id: string) {
    setExpandedBrands(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpandedBrands(new Set(groups.map(g => g.company.id)))
  }
  function collapseAll() {
    setExpandedBrands(new Set())
  }

  const totalDeals = deals.length
  const activePipeline = totalNumericValue(deals.filter(d => !CLOSED_STAGES.has(d.stage)))

  return (
    <>
      {showCreateBrand && (
        <CreateBrandModal
          onClose={() => setShowCreateBrand(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['companies'] })
            setShowCreateBrand(false)
          }}
        />
      )}
      {showCreateDeal && (
        <CreateDealModal
          companies={companies}
          onClose={() => setShowCreateDeal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['deals'] })
            setShowCreateDeal(false)
          }}
        />
      )}

      <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 shrink-0">
          <div>
            <div className="text-[13px] font-semibold text-slate-900">Deals</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isLoading
                ? 'Loading…'
                : `${groups.length} brand${groups.length !== 1 ? 's' : ''} · ${totalDeals} deal${totalDeals !== 1 ? 's' : ''} · ${activePipeline > 0 ? formatValue(String(activePipeline)) + ' pipeline' : 'No pipeline value'}`
              }
            </div>
          </div>

          <div className="sm:ml-auto flex flex-wrap gap-2 items-center">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`h-[26px] px-2.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                List
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`h-[26px] px-2.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5 ${viewMode === 'graph' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="12" cy="12" r="2" />
                  <line x1="7" y1="12" x2="10" y2="12" /><line x1="13.4" y1="10.6" x2="17" y2="6.9" /><line x1="13.4" y1="13.4" x2="17" y2="17.1" />
                </svg>
                Graph
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-black/[.06] rounded-lg px-2.5 py-[5px] flex-1 sm:flex-none sm:w-[200px] min-w-[140px]">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="text-slate-400 shrink-0" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <Input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search deals…"
                  className="border-none bg-transparent outline-none text-[12.5px] text-slate-900 w-full placeholder:text-slate-400 focus:ring-0 px-0 py-0 rounded-none h-auto shadow-none"
                />
              </div>

            {/* Expand/Collapse (list mode only) */}
            {viewMode === 'list' && (
              <>
                <button
                  onClick={expandAll}
                  className="h-[30px] px-3 rounded-lg border border-black/[.08] text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Expand all
                </button>
                <button
                  onClick={collapseAll}
                  className="h-[30px] px-3 rounded-lg border border-black/[.08] text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Collapse all
                </button>
              </>
            )}

            {/* New Brand */}
            <button
              onClick={() => setShowCreateBrand(true)}
              className="h-[30px] px-3 rounded-lg border border-black/[.08] text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Brand
            </button>

            {/* New Deal */}
            <button
              onClick={() => setShowCreateDeal(true)}
              className="h-[30px] px-3 rounded-lg text-[12px] font-medium text-white transition-colors flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Deal
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <p className="text-[12px] text-slate-400">Loading deals…</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && deals.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="No deals yet"
              description="Create a brand and add your first deal to start tracking your pipeline"
            />
          </div>
        )}

        {/* Graph view */}
        {!isLoading && deals.length > 0 && viewMode === 'graph' && (
          <div className="flex-1 rounded-xl overflow-hidden border border-black/[.06]">
            <DealsGraph
              companies={companies}
              deals={deals}
              onOpenDeal={onOpenDeal}
            />
          </div>
        )}

        {/* List view */}
        {!isLoading && deals.length > 0 && viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto bg-white border border-black/[.06] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-slate-400">
                No deals matching &quot;{search}&quot;
              </div>
            ) : (
              filtered.map(group => {
                const expanded = expandedBrands.has(group.company.id)
                return (
                  <div key={group.company.id}>
                    <BrandHeader
                      group={group}
                      expanded={expanded}
                      onToggle={() => toggleBrand(group.company.id)}
                    />
                    {expanded && group.deals.map(deal => (
                      <DealRow
                        key={deal.id}
                        deal={deal}
                        color={group.color}
                        onClick={() => onOpenDeal(deal.id)}
                      />
                    ))}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </>
  )
}
