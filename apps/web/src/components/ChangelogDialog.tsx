'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { X, Sparkles, Zap, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_CONFIG, CHANGELOG_OPEN_EVENT, type ChangeLogCategory } from '@/lib/changelog-config'

const STORAGE_KEY = 'symph-crm:changelog:last-seen'

const CATEGORY_LABEL: Record<ChangeLogCategory, string> = {
  feature: 'New features',
  improvement: 'Improvements',
  fix: 'Bug fixes',
}

const CATEGORY_TAG: Record<ChangeLogCategory, string> = {
  feature: 'new',
  improvement: 'improved',
  fix: 'fixed',
}

const CATEGORY_ICON: Record<ChangeLogCategory, React.ComponentType<{ size?: number }>> = {
  feature: Sparkles,
  improvement: Zap,
  fix: Wrench,
}

const CHANGELOG_FILES: { category: ChangeLogCategory; path: string }[] = [
  { category: 'feature', path: '/changelog/new-features.md' },
  { category: 'improvement', path: '/changelog/improvements.md' },
  { category: 'fix', path: '/changelog/bug-fixes.md' },
]

type ChangeLogEntry = {
  id: string
  title: string
  description: string
  category: ChangeLogCategory
}

function parseMarkdownEntries(category: ChangeLogCategory, markdown: string): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = []
  const lines = markdown.split('\n')
  let currentTitle = ''
  let currentBody: string[] = []

  function flush() {
    if (!currentTitle.trim()) return
    const description = currentBody
      .map(line => line.replace(/^- /, '').trim())
      .filter(Boolean)
      .join(' ')

    entries.push({
      id: `${category}-${entries.length}-${currentTitle}`,
      title: currentTitle.trim(),
      description,
      category,
    })
  }

  for (const line of lines) {
    const title = line.match(/^##\s+(.+)$/)
    if (title) {
      flush()
      currentTitle = title[1] ?? ''
      currentBody = []
      continue
    }
    if (!line.startsWith('#')) currentBody.push(line)
  }

  flush()
  return entries
}

function signatureFor(rows: ChangeLogEntry[]): string {
  return rows.map(row => `${row.category}:${row.title}:${row.description}`).join('|')
}

export function ChangelogDialog() {
  const searchParams = useSearchParams()
  const isPreview = searchParams.has('preview-changelog')
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ChangeLogEntry[]>([])
  const [signature, setSignature] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadChangeLog() {
      const loaded = await Promise.all(
        CHANGELOG_FILES.map(async file => {
          const response = await fetch(file.path)
          if (!response.ok) return []
          return parseMarkdownEntries(file.category, await response.text())
        }),
      )
      if (cancelled) return

      const nextRows = loaded.flat()
      const nextSignature = signatureFor(nextRows)
      setRows(nextRows)
      setSignature(nextSignature)

      if (nextRows.length === 0) return

      const lastSeen = window.localStorage.getItem(STORAGE_KEY)
      setOpen(isPreview || lastSeen !== nextSignature)
    }

    loadChangeLog()

    return () => {
      cancelled = true
    }
  }, [isPreview])

  useEffect(() => {
    function handleOpen() {
      setOpen(true)
    }

    window.addEventListener(CHANGELOG_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(CHANGELOG_OPEN_EVENT, handleOpen)
  }, [])

  const updateCount = rows.length

  const grouped = useMemo(() => {
    const map = new Map<ChangeLogCategory, ChangeLogEntry[]>()
    for (const r of rows) {
      const arr = map.get(r.category) ?? []
      arr.push(r)
      map.set(r.category, arr)
    }
    return CHANGELOG_FILES
      .map(file => file.category)
      .filter(category => map.has(category))
      .map(c => ({ category: c, items: map.get(c)! }))
  }, [rows])

  function handleClose() {
    if (signature) window.localStorage.setItem(STORAGE_KEY, signature)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 animate-in fade-in-0 duration-150 ease-out"
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-card rounded-lg border border-black/[.06] dark:border-white/[.08]',
          'shadow-lg',
          'w-full max-w-[520px] mx-4 max-h-[80vh]',
          'flex flex-col overflow-hidden',
          'animate-in zoom-in-95 fade-in-0 duration-150 ease-out',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative px-5 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.08] bg-gradient-to-b from-primary/10 to-transparent dark:from-primary/10 shrink-0">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
          >
            <X size={14} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-atom font-semibold uppercase tracking-[0.08em] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Latest update
          </div>
          <div className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">What&rsquo;s new</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            We have been shipping fast. Here is everything that changed.
          </div>
          <div className="font-mono text-atom uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 mt-2.5">
            {updateCount} {updateCount === 1 ? 'update' : 'updates'}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {grouped.map(group => {
            const conf = CATEGORY_CONFIG[group.category]
            const Icon = CATEGORY_ICON[group.category]
            return (
              <div key={group.category} className="mb-5 last:mb-0">
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: conf.bg, color: conf.color }}
                  >
                    <Icon size={12} />
                  </div>
                  <span
                    className="text-atom font-semibold uppercase tracking-[0.08em]"
                    style={{ color: conf.color }}
                  >
                    {CATEGORY_LABEL[group.category]}
                  </span>
                  <div className="flex-1 h-px bg-black/[.06] dark:bg-white/[.06] ml-1" />
                </div>
                {/* Entry cards */}
                <div className="space-y-1.5">
                  {group.items.map(r => (
                    <div
                      key={r.id}
                      className="bg-slate-50 dark:bg-white/[.03] hover:bg-slate-100/70 dark:hover:bg-white/[.05] border border-black/[.04] dark:border-white/[.06] rounded-md px-3 py-2.5 flex gap-2.5 items-start transition-colors"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                        style={{ background: conf.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-ssm font-semibold text-slate-900 dark:text-white leading-snug">
                          {r.title}
                        </div>
                        {r.description && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {r.description}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-atom font-semibold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded shrink-0" style={{ background: conf.bg, color: conf.color }}>
                        {CATEGORY_TAG[group.category]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/[.06] dark:border-white/[.08] bg-slate-50/50 dark:bg-white/[.02] flex items-center justify-between gap-3 shrink-0">
          <span className="text-xxs text-slate-400">Release notes update when the changelog markdown changes.</span>
          <button
            onClick={handleClose}
            className="h-8 px-4 flex items-center justify-center rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
