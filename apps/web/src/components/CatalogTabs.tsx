'use client'

// Reusable underline-style tab bar driven by the catalog parent category.
// Modeled on the /catalog page's tab pattern so the visual identity matches.
// Controlled: parent owns the URL state and passes value/onChange.

import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import type { ProductType } from '@/lib/types'

// `null` represents the "All" tab — no catalogProductType filter applied.
export type CatalogTabValue = ProductType | null

type CatalogTabId = 'all' | ProductType

const TABS: { id: CatalogTabId; value: CatalogTabValue; label: string }[] = [
  { id: 'all',         value: null,          label: 'All' },
  { id: 'internal',    value: 'internal',    label: 'Products' },
  { id: 'service',     value: 'service',     label: 'Services' },
  { id: 'reseller',    value: 'reseller',    label: 'Reseller' },
  { id: 'partnership', value: 'partnership', label: 'Partnership' },
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
  const items: TabFilterItem<CatalogTabId>[] = TABS.map(t => ({
    id: t.id,
    label: t.label,
    count: countFor(t.value, counts),
  }))

  return (
    <TabFilter
      items={items}
      value={value ?? 'all'}
      onChange={(next) => onChange(next === 'all' ? null : next)}
      className={className}
    />
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
