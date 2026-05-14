// Shared category styling for the file-backed "What's new" dialog.

export type ChangeLogCategory = 'feature' | 'fix' | 'improvement'

export const CHANGELOG_OPEN_EVENT = 'symph-crm:open-changelog'

export const CATEGORY_CONFIG: Record<ChangeLogCategory, { label: string; bg: string; color: string }> = {
  feature:     { label: 'Feature',     bg: 'rgba(108,99,255,0.10)',  color: '#6c63ff' },
  fix:         { label: 'Fix',         bg: 'rgba(22,163,74,0.10)',   color: '#16a34a' },
  improvement: { label: 'Improvement', bg: 'rgba(37,99,235,0.10)',   color: '#2563eb' },
}
