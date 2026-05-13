'use client'

// Reusable underline-style tab bar driven by the catalog parent category.
// Modeled on the /catalog page's tab pattern so the visual identity matches.
// Controlled: parent owns the URL state and passes value/onChange.

import { cn } from '@/lib/utils'
import type { ProductType } from '@/lib/types'

// `null` represents the "All" tab — no catalogProductType filter applied.
export type CatalogTabValue = ProductType | null

const TABS: { id: CatalogTabValue; label: string }[] = [
  { id: null,          label: 'All' },
  { id: 'internal',    label: 'Products' },
  { id: 'service',     label: 'Services' },
  { id: 'reseller',    label: 'Reseller' },
  { id: 'partnership', label: 'Partnership' },
]

// counts is keyed by ProductType for the named tabs; `all` is the All tab.
export type CatalogTabCounts = Partial<Record<Exclude<CatalogTabValue, null> | 'all', number>>

type Props = {
  value: CatalogTabValue
  onChange: (next: CatalogTabValue) => void
  counts?: CatalogTabCounts
  className?: string
}

function countFor(value: CatalogTabValue, counts?: CatalogTabCounts): number | undefined {
  if (!counts) return undefined
  return value === null ? counts.all : counts[value]
}

export function CatalogTabs({ value, onChange, counts, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-black/[.06] dark:border-white/[.08]', className)}>
      {TABS.map(t => {
        const active = value === t.id
        const n = countFor(t.id, counts)
        return (
          <button
            key={t.label}
            onClick={() => onChange(t.id)}
            className={cn(
              'px-3 py-2 text-ssm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            {t.label}
            {n !== undefined && (
              <span
                className={cn(
                  'text-atom font-semibold tabular-nums px-1.5 py-0.5 rounded-full',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400',
                )}
              >
                {n}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// URL helpers — kept here so the slug<->ProductType mapping has one home.
export function tabValueFromSlug(slug: string | null | undefined): CatalogTabValue {
  switch (slug) {
    case 'products':    return 'internal'
    case 'services':    return 'service'
    case 'reseller':    return 'reseller'
    case 'partnership': return 'partnership'
    default:            return null
  }
}

export function tabSlugFromValue(value: CatalogTabValue): string {
  switch (value) {
    case 'internal':    return 'products'
    case 'service':     return 'services'
    case 'reseller':    return 'reseller'
    case 'partnership': return 'partnership'
    default:            return 'all'
  }
}
