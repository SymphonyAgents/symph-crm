import { leads } from '@symph-crm/database'

export type LeadListParams = {
  workspaceId?: string
  status?: string
  sourceName?: string
  search?: string
  limit?: number
}

export type CreateLeadData = typeof leads.$inferInsert

export type UpdateLeadData = Partial<typeof leads.$inferInsert>

export type ConvertLeadData = {
  companyId?: string
  contactId?: string
  assignedTo?: string
  dealTitle?: string
  conversionNotes?: string
}
