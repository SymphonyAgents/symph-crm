export * from './workspaces'
export * from './users'
export * from './companies'
export * from './contacts'
export * from './products'       // tiers

export * from './catalog-items'
export * from './deals'
export * from './deal-contacts'
export * from './documents'   // replaces notes — content lives in NFS (storage_path), metadata only in DB
export * from './proposals'           // proposal chain identity (title, deal, pin, soft-delete)
export * from './proposal-versions'   // versioned HTML — inline text column
export * from './proposal-share-links' // public share tokens, version-pinned
export * from './activities'
export * from './files'
export * from './pipeline'
export * from './chat'
export * from './auth'
export * from './pitch-decks'
export * from './customization-requests'
export * from './calendar'
export * from './audit-logs'
export * from './billing'
export * from './notifications'
export * from './recordings'
export * from './meetings'
