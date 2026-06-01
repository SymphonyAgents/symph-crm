import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { withTimezone: true }),
  image: text('image'),
  // RBAC: SALES = full access, BUILD = restricted view-only, PARTNER = external partner portal access
  role: text('role', { enum: ['SALES', 'BUILD', 'PARTNER'] }).default('BUILD').notNull(),
  status: text('status', { enum: ['active', 'pending', 'rejected'] }).default('active').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  passwordHash: text('passwordHash'),
  // Onboarding profile fields
  firstName: text('first_name'),
  middleName: text('middle_name'),
  lastName: text('last_name'),
  nickname: text('nickname'),
  currentTeam: text('current_team'),
  isOnboarded: boolean('is_onboarded').default(false).notNull(),
  discordId: text('discord_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
})
