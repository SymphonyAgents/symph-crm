'use client'

import { useRouter } from 'next/navigation'
import { getBrandColor, getInitials, formatDealValue, totalNumericValue } from '@/lib/utils'
import { STAGE_COLORS, STAGE_LABELS } from '@/lib/constants'
import type { ApiCompanyDetail, ApiDeal, ApiDocument, DealNoteFile } from '@/lib/types'
import type { WikiSelection } from './WikiSidebar'
import { useGetDealNotes, useGetDocumentsByDeal, useGetDocumentContent, useGetDocumentPreview } from '@/lib/hooks/queries'

type WikiContentProps = {
  selection: WikiSelection
  companies: ApiCompanyDetail[]
  deals: ApiDeal[]
  onSelectDeal: (deal: ApiDeal, company: ApiCompanyDetail | null) => void
  onBack?: () => void
  /** ?cat= URL param: general | meeting | discovery | transcript | proposal | notes | resources | log */
  activeCat?: string
  /** ?file= URL param: filename within the category (not used for log/resources) */
  activeFile?: string
  /** ?docId= URL param: documents.id of a resource being viewed inline */
  activeDocId?: string
}

export function WikiContent({
  selection,
  companies,
  deals,
  onSelectDeal,
  onBack,
  activeCat,
  activeFile,
  activeDocId,
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
      activeCat={activeCat}
      activeFile={activeFile}
      activeDocId={activeDocId}
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

// ─── Brand fallback (used only if a brand has no deals) ──────────────────────

function WikiBrand({
  company,
  deals,
  onSelectDeal,
  onBack,
}: {
  company: ApiCompanyDetail
  deals: ApiDeal[]
  onSelectDeal: (deal: ApiDeal) => void
  onBack?: () => void
}) {
  const color = getBrandColor(company.name)

  return (
    <div className="flex flex-col h-full">
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

      <div className="px-5 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.06] shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `${color}15`, color }}
          >
            {getInitials(company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sbase font-semibold text-slate-900 dark:text-white truncate">{company.name}</h2>
            {company.industry && (
              <span className="text-xxs text-slate-400">{company.industry}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {deals.length === 0 ? (
          <p className="text-xxs text-slate-400 text-center py-12">No deals for this brand yet</p>
        ) : (
          <div className="space-y-1">
            {deals.map(deal => {
              const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
              return (
                <button
                  key={deal.id}
                  onClick={() => onSelectDeal(deal)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[.04]"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor }} />
                  <span className="flex-1 text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{deal.title}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Deal detail with selected note rendered inline ──────────────────────────

const VALID_CATEGORIES = new Set(['general', 'meeting', 'discovery', 'transcript', 'proposal', 'notes'])

const NOTE_TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  general:    { text: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  meeting:    { text: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  discovery:  { text: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  transcript: { text: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  proposal:   { text: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  notes:      { text: '#6c63ff', bg: 'rgba(108,99,255,0.08)' },
  resources:  { text: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  log:        { text: '#64748b', bg: 'rgba(100,116,139,0.08)' },
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function extractNoteTitle(filename: string, content: string): string {
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}[-_]?/, '')
    .replace(/[-_]/g, ' ')
    .trim() || filename
}

function WikiDeal({
  deal,
  company,
  onOpenFull,
  onBack,
  activeCat,
  activeFile,
  activeDocId,
}: {
  deal: ApiDeal
  company: ApiCompanyDetail | null
  onOpenFull: () => void
  onBack?: () => void
  activeCat?: string
  activeFile?: string
  activeDocId?: string
}) {
  const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
  const brandColor = company ? getBrandColor(company.name) : '#64748b'

  return (
    <div className="flex flex-col h-full">
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

      {/* Compact deal header */}
      <div className="px-5 py-3.5 border-b border-black/[.06] dark:border-white/[.06] shrink-0">
        <div className="flex items-center gap-3">
          {company && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `${brandColor}18`, color: brandColor }}
            >
              {getInitials(company.name)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-ssm font-semibold text-slate-900 dark:text-white truncate leading-snug">
              {deal.title}
            </h2>
            {company && (
              <span className="text-xxs text-slate-500 dark:text-slate-400">{company.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xxs font-medium whitespace-nowrap"
              style={{ background: `${stageColor}18`, color: stageColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor }} />
              {STAGE_LABELS[deal.stage] ?? deal.stage}
            </span>

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

      {/* Selected note / resource / log content */}
      <div className="flex-1 overflow-y-auto">
        <DealNoteView
          dealId={deal.id}
          activeCat={activeCat}
          activeFile={activeFile}
          activeDocId={activeDocId}
        />
      </div>
    </div>
  )
}

// ─── Note / resource / log renderer ──────────────────────────────────────────

function DealNoteView({
  dealId,
  activeCat,
  activeFile,
  activeDocId,
}: {
  dealId: string
  activeCat?: string
  activeFile?: string
  activeDocId?: string
}) {
  const { data, isLoading } = useGetDealNotes(dealId)
  const { data: docs = [] } = useGetDocumentsByDeal(dealId)

  if (isLoading) {
    return (
      <div className="px-6 pt-6 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-4 rounded bg-slate-100 dark:bg-white/[.04]" />
        ))}
      </div>
    )
  }

  if (!data) return null

  if (!activeCat) {
    return <p className="text-xxs text-slate-400 text-center py-12">Select a note from the sidebar</p>
  }

  if (activeCat === 'log') {
    return <LogView log={data.log} />
  }

  if (activeCat === 'resources') {
    if (!activeDocId) {
      return <p className="text-xxs text-slate-400 text-center py-12">Select a resource from the sidebar</p>
    }
    const doc = docs.find(d => d.id === activeDocId)
    if (!doc) {
      return <p className="text-xxs text-slate-400 text-center py-12">Resource not found</p>
    }
    return <ResourceInline doc={doc} />
  }

  if (!VALID_CATEGORIES.has(activeCat)) {
    return <p className="text-xxs text-slate-400 text-center py-12">Unknown category</p>
  }

  if (!activeFile) {
    return <p className="text-xxs text-slate-400 text-center py-12">Select a note from the sidebar</p>
  }

  const cat = activeCat as keyof typeof data.categories
  const note = data.categories[cat]?.find(n => n.filename === activeFile)

  if (!note) {
    return <p className="text-xxs text-slate-400 text-center py-12">Note not found</p>
  }

  return <NoteContent note={note} category={activeCat} />
}

// ── Resource renderer (inline — markdown / image / audio / pdf / fallback) ───

function isMarkdownDoc(doc: ApiDocument): boolean {
  if (doc.storagePath?.endsWith('.md')) return true
  if (doc.tags?.includes('markdown')) return true
  if (doc.tags?.includes('notes')) return true
  return false
}

function isImageDoc(doc: ApiDocument): boolean {
  return ['jpeg', 'jpg', 'png', 'webp', 'gif'].some(t => doc.tags?.includes(t))
}

function isAudioDoc(doc: ApiDocument): boolean {
  return ['mp4', 'x-m4a', 'mpeg', 'mp3', 'm4a'].some(t => doc.tags?.includes(t))
}

function isPdfDoc(doc: ApiDocument): boolean {
  if (doc.storagePath?.toLowerCase().endsWith('.pdf')) return true
  if (doc.tags?.includes('pdf')) return true
  return false
}

function ResourceInline({ doc }: { doc: ApiDocument }) {
  const isImage = isImageDoc(doc)
  const isAudio = isAudioDoc(doc)
  const isPdf = isPdfDoc(doc)
  const isMarkdown = isMarkdownDoc(doc)

  const filename = doc.storagePath?.split('/').pop() ?? doc.title

  if (isPdf) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-black/[.06] dark:border-white/[.06] shrink-0">
          <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-snug break-words">
            {filename}
          </h1>
        </div>
        <iframe
          src={`/api/documents/${doc.id}/file?inline=1`}
          title={filename}
          className="w-full flex-1 border-0 bg-white dark:bg-[#1a1a1d]"
        />
      </div>
    )
  }

  return (
    <div className="px-6 py-5 max-w-[820px] mx-auto">
      <div className="mb-5">
        <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-snug break-words">
          {filename}
        </h1>
      </div>

      {isImage ? <ImageInline doc={doc} /> :
        isAudio ? <AudioInline doc={doc} /> :
        isMarkdown ? <MarkdownDocInline doc={doc} /> :
        <FallbackInline doc={doc} />}
    </div>
  )
}

function ImageInline({ doc }: { doc: ApiDocument }) {
  const { data: preview, isLoading } = useGetDocumentPreview(doc.id)
  if (isLoading) {
    return <div className="h-48 flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" /></div>
  }
  if (!preview?.url) {
    return <p className="text-xs text-slate-400">Image not available</p>
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={preview.url}
      alt={doc.title}
      className="max-w-full max-h-[80vh] rounded-lg object-contain"
    />
  )
}

function AudioInline({ doc }: { doc: ApiDocument }) {
  const { data: preview, isLoading } = useGetDocumentPreview(doc.id)
  if (isLoading) {
    return <div className="h-24 flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" /></div>
  }
  if (!preview?.url) {
    return <p className="text-xs text-slate-400">Audio not available</p>
  }
  return (
    <audio controls src={preview.url} className="w-full" style={{ colorScheme: 'light dark' }}>
      Your browser does not support the audio element.
    </audio>
  )
}

function MarkdownDocInline({ doc }: { doc: ApiDocument }) {
  const { data, isLoading } = useGetDocumentContent(doc.id)
  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="animate-pulse h-4 rounded bg-slate-100 dark:bg-white/[.04]" />)}</div>
  }
  const content = data?.content ?? ''
  if (!content) {
    return <p className="text-xs text-slate-400">No content</p>
  }
  return <div className="prose-wiki space-y-1">{renderSimpleMarkdown(content)}</div>
}

function FallbackInline({ doc }: { doc: ApiDocument }) {
  const filename = doc.storagePath?.split('/').pop() ?? doc.title
  return (
    <div className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.03] p-6">
      <div className="flex items-center gap-3 mb-3">
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className="text-slate-400 shrink-0">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{filename}</p>
          {doc.excerpt && <p className="text-xxs text-slate-400 mt-0.5 line-clamp-2">{doc.excerpt}</p>}
        </div>
      </div>
      <a
        href={`/api/documents/${doc.id}/file`}
        download={filename}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download
      </a>
    </div>
  )
}

function NoteContent({ note, category }: { note: DealNoteFile; category: string }) {
  const title = extractNoteTitle(note.filename, note.content)
  const typeColor = getNoteTypeColor(category)

  return (
    <div className="px-8 py-6 max-w-[820px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-2 py-0.5 rounded text-atom font-semibold uppercase tracking-wide"
            style={{ background: typeColor.bg, color: typeColor.text }}
          >
            {category}
          </span>
          <span className="text-xxs text-slate-400 tabular-nums">{formatNoteDate(note.createdAt)}</span>
        </div>
        <h1 className="text-[26px] font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
          {title}
        </h1>
      </div>
      <div className="space-y-1">
        {renderSimpleMarkdown(note.content)}
      </div>
    </div>
  )
}

function LogView({ log }: { log: string | null }) {
  if (!log) {
    return <p className="text-xxs text-slate-400 text-center py-12">No log entries yet</p>
  }

  return (
    <div className="px-6 py-5 max-w-[820px] mx-auto">
      <div className="mb-4">
        <span
          className="inline-block px-2 py-0.5 rounded text-atom font-semibold uppercase tracking-wide"
          style={{ background: 'rgba(100,116,139,0.08)', color: '#64748b' }}
        >
          log
        </span>
      </div>
      <div className="space-y-2 rounded-lg bg-slate-50/60 px-4 py-3 dark:bg-white/[.03]">
        {log.split('\n').filter(Boolean).map((line, i) => (
          <p key={i} className="text-xs leading-7 text-slate-500 dark:text-slate-400 font-mono">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

// ─── Markdown renderer (Obsidian-style typography) ───────────────────────────

const NUMBERED_RE = /^(\d+)\.\s+(.*)$/

function renderSimpleMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block ```
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      nodes.push(
        <pre key={`code-${i}`} className="my-3 px-4 py-3 rounded-md bg-slate-100 dark:bg-white/[.04] border-l-2 border-slate-300 dark:border-white/[.15] overflow-x-auto">
          <code className="text-[13px] font-mono text-slate-700 dark:text-slate-300 leading-6 whitespace-pre">
            {codeLines.join('\n')}
          </code>
        </pre>,
      )
      continue
    }

    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="text-[17px] font-semibold text-slate-800 dark:text-slate-200 mt-5 mb-2">
          {inlineFormat(line.slice(4))}
        </h3>,
      )
      i++; continue
    }

    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="text-[20px] font-semibold text-slate-900 dark:text-white mt-6 mb-2.5">
          {inlineFormat(line.slice(3))}
        </h2>,
      )
      i++; continue
    }

    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={i} className="text-[24px] font-bold text-slate-900 dark:text-white mt-6 mb-3 tracking-tight">
          {inlineFormat(line.slice(2))}
        </h1>,
      )
      i++; continue
    }

    // Bullet list — group consecutive bullets
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-1">
          {items.map((it, j) => (
            <li key={j} className="flex gap-2 text-[15px] text-slate-700 dark:text-slate-300 leading-7">
              <span className="shrink-0 mt-[10px] w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              <span>{inlineFormat(it)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // Numbered list
    if (NUMBERED_RE.test(line)) {
      const items: string[] = []
      let startNum = 1
      while (i < lines.length) {
        const m = lines[i].match(NUMBERED_RE)
        if (!m) break
        if (items.length === 0) startNum = parseInt(m[1], 10)
        items.push(m[2])
        i++
      }
      nodes.push(
        <ol key={`ol-${i}`} start={startNum} className="my-2 space-y-1.5 pl-7 list-decimal marker:text-slate-400 dark:marker:text-slate-500 marker:tabular-nums">
          {items.map((it, j) => (
            <li key={j} className="text-[15px] text-slate-700 dark:text-slate-300 leading-7 pl-1">
              {inlineFormat(it)}
            </li>
          ))}
        </ol>,
      )
      continue
    }

    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-3" />)
      i++; continue
    }

    nodes.push(
      <p key={i} className="text-[15px] text-slate-700 dark:text-slate-300 leading-7">
        {inlineFormat(line)}
      </p>,
    )
    i++
  }

  return nodes
}

// Inline formatting: **bold** and `code`
function inlineFormat(text: string): React.ReactNode {
  // Split on `code` segments first, then on **bold**
  const parts: React.ReactNode[] = []
  const codeRe = /`([^`]+)`/g
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = codeRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{boldFormat(text.slice(lastIndex, match.index), key)}</span>)
    }
    parts.push(
      <code key={key++} className="px-1.5 py-0.5 rounded text-[0.9em] font-mono bg-slate-100 dark:bg-white/[.06] text-slate-800 dark:text-slate-200">
        {match[1]}
      </code>,
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{boldFormat(text.slice(lastIndex), key)}</span>)
  }
  return <>{parts}</>
}

function boldFormat(text: string, baseKey: number): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={`${baseKey}-${i}`} className="font-semibold text-slate-900 dark:text-white">{part}</strong>
      : <span key={`${baseKey}-${i}`}>{part}</span>,
  )
}
