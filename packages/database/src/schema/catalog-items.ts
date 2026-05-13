import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

// Catalog table — holds every kind of catalog item a deal can point at:
//   - 'internal'     → in-house Symph products (HireAI, Daily Drip, ...)
//   - 'service'      → service offerings (The Agency, Consulting, Staff Augmenting)
//   - 'reseller'     → reseller partnerships (GWS, Josys, GCP, Apigee)
//   - 'partnership'  → strategic partnerships (none yet — reserved)
//
// `slug` matches legacy values stored in `deals.services_tags` so existing
// deals keep working (e.g. 'agency', 'reseller_josys').
export const catalogItems = pgTable('catalog_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  productType: text('product_type', { enum: ['internal', 'service', 'reseller', 'partnership'] })
    .default('internal')
    .notNull(),
  slug: text('slug'),
  name: text('name').notNull(),
  industry: text('industry'),
  landingPageLink: text('landing_page_link'),
  iconUrl: text('icon_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
