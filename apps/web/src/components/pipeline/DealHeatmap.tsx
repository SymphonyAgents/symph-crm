'use client'

import { useMemo } from 'react'
import { cn, toPascalCase } from '@/lib/utils'
import { formatDealName } from '@/lib/format-deal-name'
import { STAGE_LABELS } from '@/lib/constants'
import type { ApiDeal } from '@/lib/types'

type DealHeatmapProps = {
  deals: ApiDeal[]
  companyMap: Map<string, string>
  onOpenDeal: (id: string) => void
}

type HeatmapSignalKey = 'engagement' | 'intent' | 'fit' | 'timing'

type HeatmapSignal = {
  key: HeatmapSignalKey
  label: string
}

type HeatmapDealScore = {
  deal: ApiDeal
  companyName: string
  signals: Record<HeatmapSignalKey, number>
  score: number
}

const HEATMAP_SIGNALS: HeatmapSignal[] = [
  { key: 'engagement', label: 'Engage' },
  { key: 'intent', label: 'Intent' },
  { key: 'fit', label: 'Fit' },
  { key: 'timing', label: 'Timing' },
]

const STAGE_INTENT_SCORE: Record<string, number> = {
  proposal: 92,
  demo: 84,
  assessment: 76,
  discovery: 66,
  lead: 48,
  parked: 28,
  closed_won: 96,
  closed_lost: 12,
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function hashDealSeed(deal: ApiDeal, salt: string) {
  const input = `${deal.id}:${deal.title}:${salt}`
  let hash = 0
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) % 997
  }
  return hash
}

function getRecentActivityAgeInDays(deal: ApiDeal) {
  const value = deal.lastActivityAt ?? deal.updatedAt ?? deal.createdAt
  if (!value) return 90
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 90
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000))
}

function getEngagementScore(deal: ApiDeal) {
  const ageInDays = getRecentActivityAgeInDays(deal)
  const recencyScore = ageInDays <= 3 ? 92 : ageInDays <= 7 ? 78 : ageInDays <= 14 ? 62 : ageInDays <= 30 ? 44 : 24
  const documentSignal = Math.min(12, (deal.documentCount ?? 0) * 3)
  return clampScore(recencyScore + documentSignal + (hashDealSeed(deal, 'engagement') % 7) - 3)
}

function getIntentScore(deal: ApiDeal) {
  const stageScore = STAGE_INTENT_SCORE[deal.stage] ?? 45
  return clampScore(stageScore + (hashDealSeed(deal, 'intent') % 9) - 4)
}

function getFitScore(deal: ApiDeal) {
  const value = Number(deal.value ?? 0)
  const revenueSignal = Number.isFinite(value) && value > 0 ? Math.min(26, Math.log10(value + 1) * 5) : 0
  const serviceSignal = Math.min(18, (deal.servicesTags?.length ?? 0) * 6)
  const catalogSignal = deal.catalogItemId ? 12 : 0
  return clampScore(38 + revenueSignal + serviceSignal + catalogSignal + (hashDealSeed(deal, 'fit') % 11) - 5)
}

function getTimingScore(deal: ApiDeal) {
  const ageInDays = getRecentActivityAgeInDays(deal)
  const stageLift = ['proposal', 'demo', 'assessment'].includes(deal.stage) ? 20 : deal.stage === 'parked' ? -18 : 0
  const recencyScore = ageInDays <= 7 ? 68 : ageInDays <= 21 ? 54 : ageInDays <= 45 ? 38 : 24
  return clampScore(recencyScore + stageLift + (hashDealSeed(deal, 'timing') % 9) - 4)
}

function getDealScore(deal: ApiDeal, companyMap: Map<string, string>): HeatmapDealScore {
  const signals = {
    engagement: getEngagementScore(deal),
    intent: getIntentScore(deal),
    fit: getFitScore(deal),
    timing: getTimingScore(deal),
  }
  const score = clampScore((signals.engagement * 0.3) + (signals.intent * 0.3) + (signals.fit * 0.2) + (signals.timing * 0.2))
  return {
    deal,
    companyName: companyMap.get(deal.companyId) ?? 'No Brand',
    signals,
    score,
  }
}

function getScoreCellTone(score: number) {
  if (score >= 85) return 'bg-blue-950 text-blue-50'
  if (score >= 70) return 'bg-blue-900 text-blue-50'
  if (score >= 55) return 'bg-blue-700 text-white'
  if (score >= 40) return 'bg-blue-400 text-blue-950'
  return 'bg-blue-200 text-blue-950'
}

function HeatmapCell({ score, isTotal = false }: { score: number; isTotal?: boolean }) {
  return (
    <div className="flex justify-center">
      <div className={cn(
        'flex h-7 w-7 items-center justify-center rounded-[6px] text-atom font-semibold tabular-nums shadow-sm sm:h-8 sm:w-8 sm:text-xxs',
        getScoreCellTone(score),
        isTotal && 'ring-1 ring-blue-950/10 dark:ring-white/20',
      )}>
        {score}
      </div>
    </div>
  )
}

function HeatmapLegend() {
  const swatches = [20, 40, 55, 70, 85]
  return (
    <div className="flex flex-wrap items-center gap-2 text-xxs font-medium text-muted-foreground">
      <span>Cold</span>
      <div className="flex items-center gap-1">
        {swatches.map(score => (
          <span key={score} className={cn('h-3 w-5 rounded-sm', getScoreCellTone(score))} />
        ))}
      </div>
      <span>Hot</span>
      <span className="ml-0 text-text-faint sm:ml-2">0-100 signal</span>
    </div>
  )
}

function heatmapGridClassName() {
  return 'grid min-w-[820px] grid-cols-[44px_minmax(320px,1fr)_repeat(5,76px)] items-center'
}

function heatmapRowClassName(extraClassName?: string) {
  return cn(heatmapGridClassName(), 'gap-2 px-4', extraClassName)
}

function HeatmapHeader() {
  return (
    <div className={heatmapRowClassName('border-b border-border py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground')}>
      <div>#</div>
      <div>Deal</div>
      {HEATMAP_SIGNALS.map(signal => <div key={signal.key} className="text-center">{signal.label}</div>)}
      <div className="text-center">Score</div>
    </div>
  )
}

function HeatmapRow({ item, index, onOpenDeal }: { item: HeatmapDealScore; index: number; onOpenDeal: (id: string) => void }) {
  const stageLabel = STAGE_LABELS[item.deal.stage] ?? toPascalCase(item.deal.stage)
  return (
    <button
      type="button"
      onClick={() => onOpenDeal(item.deal.id)}
      className={heatmapRowClassName('min-h-[48px] border-b border-border/80 py-1.5 text-left transition-colors last:border-b-0 odd:bg-muted/15 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring')}
    >
      <div className="text-xs font-medium tabular-nums text-text-faint">{index + 1}</div>
      <div className="min-w-0 pr-3">
        <div className="truncate text-xs font-semibold text-foreground">{formatDealName(item.deal.title)}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-atom text-text-faint">
          <span className="truncate">{item.companyName}</span>
          <span>·</span>
          <span className="shrink-0">{stageLabel}</span>
        </div>
      </div>
      {HEATMAP_SIGNALS.map(signal => <HeatmapCell key={signal.key} score={item.signals[signal.key]} />)}
      <HeatmapCell score={item.score} isTotal />
    </button>
  )
}

export function DealHeatmap({ deals, companyMap, onOpenDeal }: DealHeatmapProps) {
  const scoredDeals = useMemo(() => {
    return deals
      .map(deal => getDealScore(deal, companyMap))
      .sort((a, b) => {
        const scoreDelta = b.score - a.score
        if (scoreDelta !== 0) return scoreDelta
        return formatDealName(a.deal.title).localeCompare(formatDealName(b.deal.title))
      })
  }, [companyMap, deals])

  return (
    <div className="px-4 pb-4">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Deal temperature heatmap</h2>
            <p className="mt-1 text-xxs text-muted-foreground">Grounded CRM signals, sorted by strongest current opportunity.</p>
          </div>
          <HeatmapLegend />
        </div>

        {scoredDeals.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-ssm text-muted-foreground">No deals found</p>
            <p className="mt-1 text-xxs text-text-faint">Change the AM filter or search term to widen the heatmap.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <HeatmapHeader />
            {scoredDeals.map((item, index) => (
              <HeatmapRow key={item.deal.id} item={item} index={index} onOpenDeal={onOpenDeal} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
