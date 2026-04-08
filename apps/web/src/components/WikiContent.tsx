'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, getBrandColor, getInitials, formatDealValue, totalNumericValue } from '@/lib/utils'
import { STAGE_COLORS, STAGE_LABELS } from '@/lib/constants'
import type { ApiCompanyDetail, ApiDeal, DealNoteFile } from '@/lib/types'
import type { WikiSelection } from './WikiSidebar'
import { useGetDealNotes } from '@/lib/hooks/queries'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'

type WikiContentProps = {
  selection: WikiSelection
  companies: ApiCompanyDetail[]
  deals: ApiDeal[]
  onSelectDeal: (deal: ApiDeal, company: ApiCompanyDetail | null) => void
  /** On mobile: back button fires this to return to the sidebar */
  onBack?: () => void
  /** Active tab from URL ?tab= param */
  activeTab?: string
}

export function WikiContent({
  selection,
  companies,
  deals,
  onSelectDeal,
  onBack,
  activeTab,
}: WikiContentProps) {
  const router = useRouter()

  if (selection.kind === 'none') {
    return <WikiEmpty companies={companies} deals={deals} />
  }

  if (selection.kind === 'brand') {
    return (
      <WikiBrand
        company={selection.company}
        deals={deals.filter(d => d.companyId === selection.company.id)}
        onSelectDeal={(deal) => onSelectDeal(deal, selection.company)}
        onOpenDeal={(id) => router.push(`/deals/${id}?from=wiki`)}
        onBack={onBack}
      />
    )
  }

  return (
    <WikiDeal
      deal={selection.deal}
      company={selection.company}
      onOpenFull={() => router.push(`/deals/${selection.deal.id}?from=wiki`)}
      onBack={onBack}
      activeTab={activeTab}
    />
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function WikiEmpty({ companies, deals }: { companies: ApiCompanyDetail[]; deals: ApiDeal[] }) {
  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const closedWon = deals.filter(d => d.stage === 'closed_won')
  const pipeline = totalNumericValue(openDeals)

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/[.08] dark:bg-primary/[.12] flex items-center justify-center mb-4">
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className="text-primary">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Wiki</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed mb-6">
        Select a brand or deal from the sidebar to explore details
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
        {[
          { label: 'Brands', value: companies.length },
          { label: 'Open deals', value: openDeals.length },
          { label: 'Won deals', value: closedWon.length },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] px-3 py-3 text-center"
          >
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{stat.value}</div>
            <div className="text-xxs text-slate-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {pipeline > 0 && (
        <p className="text-xxs text-slate-400 mt-3">
          {formatDealValue(String(pipeline))} open pipeline
        </p>
      )}
    </div>
  )
}

// ─── Brand detail ─────────────────────────────────────────────────────────────

function WikiBrand({
  company,
  deals,
  onSelectDeal,
  onOpenDeal,
  onBack,
}: {
  company: ApiCompanyDetail
  deals: ApiDeal[]
  onSelectDeal: (deal: ApiDeal) => void
  onOpenDeal: (id: string) => void
  onBack?: () => void
}) {
  const color = getBrandColor(company.name)
  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const pipeline = totalNumericValue(openDeals)

  return (
    <div className="flex flex-col h-full">
      {/* Back button (mobile) */}
      {onBack && (
        <div className="px-4 pt-3 pb-0 shrink-0 md:hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Brand header */}
      <div className="px-5 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.06] shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${color}15`, color }}
          >
            {getInitials(company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sbase font-semibold text-slate-900 dark:text-white truncate">{company.name}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              {company.industry && (
                <span className="text-xxs text-slate-400">{company.industry}</span>
              )}
              {company.domain && (
                <span className="text-xxs text-slate-400">{company.domain}</span>
              )}
              {company.hqLocation && (
                <span className="text-xxs text-slate-400">{company.hqLocation}</span>
              )}
            </div>
          </div>
        </div>
        {company.website && (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xxs text-primary hover:underline mb-2"
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {company.website.replace(/^https?:\/\//, '')}
          </a>
        )}

        {/* Stats */}
        <div className="flex gap-4">
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{deals.length}</span>
            <span className="text-xxs text-slate-400 ml-1">deal{deals.length !== 1 ? 's' : ''}</span>
          </div>
          {pipeline > 0 && (
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{formatDealValue(String(pipeline))}</span>
              <span className="text-xxs text-slate-400 ml-1">open pipeline</span>
            </div>
          )}
        </div>
      </div>

      {/* Deals list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {deals.length === 0 ? (
          <p className="text-xxs text-slate-400 text-center py-6">No deals for this brand</p>
        ) : (
          <div className="space-y-1">
            {deals
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title))
              .map(deal => {
                const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
                return (
                  <button
                    key={deal.id}
                    onClick={() => onSelectDeal(deal)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[.04] group"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{deal.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-atom font-medium"
                          style={{ color: stageColor }}
                        >
                          {STAGE_LABELS[deal.stage] ?? deal.stage}
                        </span>
                        {deal.value && parseFloat(deal.value) > 0 && (
                          <span className="text-atom text-slate-400 tabular-nums">
                            {formatDealValue(deal.value)}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      width={12} height={12} viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
                      className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-colors"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Deal detail ──────────────────────────────────────────────────────────────

function WikiDeal({
  deal,
  company,
  onOpenFull,
  onBack,
  activeTab,
}: {
  deal: ApiDeal
  company: ApiCompanyDetail | null
  onOpenFull: () => void
  onBack?: () => void
  activeTab?: string
}) {
  const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
  const brandColor = company ? getBrandColor(company.name) : '#64748b'

  return (
    <div className="flex flex-col h-full">
      {/* Back button (mobile) */}
      {onBack && (
        <div className="px-4 pt-3 pb-0 shrink-0 md:hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Compact deal header — single row */}
      <div className="px-5 py-3.5 border-b border-black/[.06] dark:border-white/[.06] shrink-0">
        <div className="flex items-center gap-3">
          {/* Brand avatar */}
          {company && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `${brandColor}18`, color: brandColor }}
            >
              {getInitials(company.name)}
            </div>
          )}

          {/* Title + company name */}
          <div className="flex-1 min-w-0">
            <h2 className="text-ssm font-semibold text-slate-900 dark:text-white truncate leading-snug">
              {deal.title}
            </h2>
            {company && (
              <span className="text-xxs text-slate-500 dark:text-slate-400">{company.name}</span>
            )}
          </div>

          {/* Inline badges */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Stage pill */}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xxs font-medium whitespace-nowrap"
              style={{ background: `${stageColor}18`, color: stageColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor }} />
              {STAGE_LABELS[deal.stage] ?? deal.stage}
            </span>

            {/* Outreach category */}
            {deal.outreachCategory && (
              <span className="px-2.5 py-1 rounded-full text-xxs font-medium bg-slate-100 dark:bg-white/[.06] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {deal.outreachCategory}
              </span>
            )}

            {/* Service tags */}
            {(deal.servicesTags ?? []).map(tag => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xxs font-medium whitespace-nowrap"
                style={{ background: `${stageColor}12`, color: stageColor }}
              >
                {tag}
              </span>
            ))}

            {/* More menu placeholder */}
            <button className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            {/* Open deal CTA */}
            <button
              onClick={onOpenFull}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/80 transition-colors active:scale-[0.98] whitespace-nowrap"
            >
              Open deal
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tab-based Notes — fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        <DealNotesTabs dealId={deal.id} activeTab={activeTab} />
      </div>
    </div>
  )
}

// ─── Simple markdown renderer (no external deps) ─────────────────────────────

function renderSimpleMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ## headings
    if (line.startsWith('## ')) {
      nodes.push(
        <p key={i} className="text-sbase font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-1.5">
          {line.slice(3)}
        </p>,
      )
      continue
    }

    // # headings
    if (line.startsWith('# ')) {
      nodes.push(
        <p key={i} className="text-sbase font-bold text-slate-900 dark:text-white mt-4 mb-1.5">
          {line.slice(2)}
        </p>,
      )
      continue
    }

    // ### headings
    if (line.startsWith('### ')) {
      nodes.push(
        <p key={i} className="text-sbase font-semibold text-slate-700 dark:text-slate-300 mt-3 mb-1">
          {line.slice(4)}
        </p>,
      )
      continue
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(
        <div key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400 leading-7">
          <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
          <span>{inlineBold(line.slice(2))}</span>
        </div>,
      )
      continue
    }

    // Empty lines → spacing
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />)
      continue
    }

    // Plain paragraph
    nodes.push(
      <p key={i} className="text-sm text-slate-600 dark:text-slate-400 leading-7">
        {inlineBold(line)}
      </p>,
    )
  }

  return nodes
}

/** Handle **bold** inline */
function inlineBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} className="font-semibold text-slate-800 dark:text-slate-200">{part}</span>
          : <span key={i}>{part}</span>,
      )}
    </>
  )
}

// ─── Tab-based Notes section ────────────────────────────────────────────────

type NoteTabId = 'general' | 'meeting' | 'discovery' | 'transcript' | 'proposal' | 'notes' | 'resources' | 'log'

const NOTE_TABS: Array<{ id: NoteTabId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'notes', label: 'Notes' },
  { id: 'resources', label: 'Resources' },
  { id: 'log', label: 'Log' },
]

const VALID_NOTE_TABS = new Set<NoteTabId>(['general', 'meeting', 'discovery', 'transcript', 'proposal', 'notes', 'resources', 'log'])

// Badge color per note type/category
const NOTE_TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  general:    { text: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  meeting:    { text: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  discovery:  { text: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  transcript: { text: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  proposal:   { text: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  notes:      { text: '#6c63ff', bg: 'rgba(108,99,255,0.08)' },
  internal:   { text: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  research:   { text: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
}

function getNoteTypeColor(type: string) {
  return NOTE_TYPE_COLORS[type.toLowerCase()] ?? { text: '#64748b', bg: 'rgba(100,116,139,0.08)' }
}

function formatNoteDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toISOString().slice(0, 10)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

// Extract a readable title from a note filename
function extractNoteTitle(filename: string, content: string): string {
  // Try first heading from content
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()

  // Fall back to filename without extension and timestamp
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}[-_]?/, '')
    .replace(/[-_]/g, ' ')
    .trim() || filename
}

// Extract a type/category label from the note's filename or content
function extractNoteType(_filename: string, category: string): string {
  return category.toUpperCase()
}

function DealNotesTabs({ dealId, activeTab }: { dealId: string; activeTab?: string }) {
  const router = useRouter()
  const { data, isLoading } = useGetDealNotes(dealId)
  const [selectedNote, setSelectedNote] = useState<{ note: DealNoteFile; category: string } | null>(null)

  if (isLoading) {
    return (
      <div className="px-5 pt-4 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-12 rounded-lg bg-slate-100 dark:bg-white/[.04]" />
        ))}
      </div>
    )
  }

  if (!data) return null

  // Flatten all notes for the "notes" tab (which aggregates all categories)
  const allNotes: Array<DealNoteFile & { category: string }> = []
  for (const [cat, files] of Object.entries(data.categories)) {
    for (const file of files) {
      allNotes.push({ ...file, category: cat })
    }
  }

  const notesCount = allNotes.length

  const counts: Record<NoteTabId, number> = {
    general: data.categories.general.length,
    meeting: data.categories.meeting.length,
    discovery: data.categories.discovery.length,
    transcript: data.categories.transcript.length,
    proposal: data.categories.proposal.length,
    notes: notesCount,
    resources: data.resources.length,
    log: data.log ? 1 : 0,
  }

  let resolvedTab: NoteTabId
  if (activeTab && VALID_NOTE_TABS.has(activeTab as NoteTabId)) {
    resolvedTab = activeTab as NoteTabId
  } else if (counts.general > 0) {
    resolvedTab = 'general'
  } else {
    resolvedTab = NOTE_TABS.find(t => counts[t.id] > 0)?.id ?? 'notes'
  }

  const hasAny = Object.values(counts).some(c => c > 0)

  if (!hasAny) {
    return (
      <div className="px-5 pt-4">
        <p className="text-xxs text-slate-400 text-center py-6">No notes yet</p>
      </div>
    )
  }

  function handleTabClick(tabId: NoteTabId) {
    router.push(`/wiki/deal/${dealId}?tab=${tabId}`)
  }

  return (
    <>
      <div className="px-5 pt-1 overflow-x-auto">
        {/* Tab bar */}
        <div className="flex border-b border-black/[.06] dark:border-white/[.06] mb-0">
          {NOTE_TABS.map(tab => {
            const count = counts[tab.id]
            const isActive = resolvedTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-ssm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'text-[9px] font-semibold px-1.5 py-0.5 rounded-full min-w-[16px] text-center',
                    isActive
                      ? 'bg-primary/15 text-primary dark:bg-primary/20'
                      : 'bg-slate-100 dark:bg-white/[.08] text-slate-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="pt-3">
          {resolvedTab === 'resources' ? (
            <ResourcesTabContent resources={data.resources} />
          ) : resolvedTab === 'log' ? (
            <LogTabContent log={data.log} />
          ) : resolvedTab === 'notes' ? (
            <NotesCompactList notes={allNotes} onSelect={(note, cat) => setSelectedNote({ note, category: cat })} />
          ) : resolvedTab === 'general' ? (
            <NotesCompactList
              notes={data.categories.general.map(n => ({ ...n, category: 'general' }))}
              onSelect={(note, cat) => setSelectedNote({ note, category: cat })}
            />
          ) : resolvedTab === 'meeting' ? (
            <NotesCompactList
              notes={data.categories.meeting.map(n => ({ ...n, category: 'meeting' }))}
              onSelect={(note, cat) => setSelectedNote({ note, category: cat })}
            />
          ) : resolvedTab === 'discovery' ? (
            <NotesCompactList
              notes={data.categories.discovery.map(n => ({ ...n, category: 'discovery' }))}
              onSelect={(note, cat) => setSelectedNote({ note, category: cat })}
            />
          ) : resolvedTab === 'transcript' ? (
            <NotesCompactList
              notes={data.categories.transcript.map(n => ({ ...n, category: 'transcript' }))}
              onSelect={(note, cat) => setSelectedNote({ note, category: cat })}
            />
          ) : resolvedTab === 'proposal' ? (
            <NotesCompactList
              notes={data.categories.proposal.map(n => ({ ...n, category: 'proposal' }))}
              onSelect={(note, cat) => setSelectedNote({ note, category: cat })}
            />
          ) : null}
        </div>
      </div>

      {/* Note detail modal */}
      {selectedNote && (
        <NoteDetailModal
          note={selectedNote.note}
          category={selectedNote.category}
          onClose={() => setSelectedNote(null)}
        />
      )}
    </>
  )
}

// ─── Compact note row list ──────────────────────────────────────────────────

function NotesCompactList({
  notes,
  onSelect,
}: {
  notes: Array<DealNoteFile & { category: string }>
  onSelect: (note: DealNoteFile, category: string) => void
}) {
  if (notes.length === 0) {
    return <p className="text-xxs text-slate-400 text-center py-6">No notes yet</p>
  }

  const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="space-y-1.5">
      {sorted.map((note) => {
        const title = extractNoteTitle(note.filename, note.content)
        const typeLabel = extractNoteType(note.filename, note.category)
        const typeColor = getNoteTypeColor(note.category)

        return (
          <button
            key={note.filename}
            onClick={() => onSelect(note, note.category)}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition-colors bg-slate-50/60 dark:bg-white/[.03] hover:bg-slate-100 dark:hover:bg-white/[.06] group"
          >
            {/* Expand chevron */}
            <svg
              width={12} height={12} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
              className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>

            {/* Title */}
            <span className="flex-1 min-w-0 text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
              {title}
            </span>

            {/* Type badge */}
            <span
              className="shrink-0 px-2 py-0.5 rounded text-atom font-semibold uppercase tracking-wide"
              style={{ background: typeColor.bg, color: typeColor.text }}
            >
              {typeLabel}
            </span>

            {/* Date */}
            <span className="shrink-0 text-xxs text-slate-400 tabular-nums">
              {formatNoteDate(note.createdAt)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function LogTabContent({ log }: { log: string | null }) {
  if (!log) {
    return <p className="text-sm text-slate-400 text-center py-6">No log entries yet</p>
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50/60 px-3.5 py-3 dark:bg-white/[.03]">
      {log.split('\n').filter(Boolean).map((line, i) => (
        <p key={i} className="text-sm leading-7 text-slate-500 dark:text-slate-400 font-mono">
          {line}
        </p>
      ))}
    </div>
  )
}

// ─── Note detail modal ──────────────────────────────────────────────────────

function NoteDetailModal({
  note,
  category,
  onClose,
}: {
  note: DealNoteFile
  category: string
  onClose: () => void
}) {
  const title = extractNoteTitle(note.filename, note.content)
  const typeLabel = extractNoteType(note.filename, category)
  const typeColor = getNoteTypeColor(category)

  useEscapeKey(useCallback(() => {
    onClose()
  }, [onClose]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] mx-4 flex flex-col bg-white dark:bg-[#1e1e21] rounded-md border border-black/[.06] dark:border-white/[.08] shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-black/[.06] dark:border-white/[.06] shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-sbase font-semibold text-slate-900 dark:text-white leading-snug mb-1.5">
              {title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-2 py-0.5 rounded text-atom font-semibold uppercase tracking-wide"
                style={{ background: typeColor.bg, color: typeColor.text }}
              >
                {typeLabel}
              </span>
              <span className="text-sm text-slate-400 tabular-nums">{formatNoteDate(note.createdAt)}</span>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors shrink-0"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose-wiki space-y-2">
            {renderSimpleMarkdown(note.content)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Resources tab (unchanged shape, compact rows) ──────────────────────────

function ResourcesTabContent({ resources }: { resources: Array<{ filename: string; size: number; ext: string }> }) {
  if (resources.length === 0) {
    return <p className="text-xxs text-slate-400 text-center py-6">No resources attached</p>
  }

  return (
    <div className="space-y-1.5">
      {resources.map((res) => (
        <div
          key={res.filename}
          className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-slate-50/60 dark:bg-white/[.03]"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className="shrink-0 text-slate-400">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" title={res.filename}>
            {res.filename}
          </span>
          <span className="text-xxs text-slate-400 shrink-0 tabular-nums">{formatFileSize(res.size)}</span>
        </div>
      ))}
    </div>
  )
}
