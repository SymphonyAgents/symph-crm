import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { tiers } from './products'
import { internalProducts } from './internal-products'
import { users } from './users'
import { deals } from './deals'

export const pitchDecks = pgTable('pitch_decks', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  internalProductId: uuid('product_id').references(() => internalProducts.id).notNull(),
  tierId: uuid('tier_id').references(() => tiers.id),

  // Deal this pitch deck was created for (optional — can be company-level)
  dealId: uuid('deal_id').references(() => deals.id),

  title: text('title').notNull(),

  // Content lives in Supabase Storage `content` bucket — never inline in DB
  // e.g. "pitch-decks/{id}/deck.html" or "pitch-decks/{id}/deck.pdf"
  storagePath: text('storage_path'),

  htmlUrl: text('html_url'),
  demoToken: text('demo_token').unique(),
  generatedBy: text('generated_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
