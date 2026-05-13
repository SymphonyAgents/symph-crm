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

type Props = {
  value: CatalogTabValue
  onChange: (next: CatalogTabValue) => void
  className?: string
}

export function CatalogTabs({ value, onChange, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-black/[.06] dark:border-white/[.08]', className)}>
      {TABS.map(t => {
        const active = value === t.id
        return (
          <button
            key={t.label}
            onClick={() => onChange(t.id)}
            className={cn(
              'px-3 py-2 text-ssm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            {t.label}
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
