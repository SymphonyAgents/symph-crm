import { CrmUserRole, PartnerCommissionStatus } from '@symph-crm/shared'
import { deals } from '@symph-crm/database'

export type DealRequestContext = {
  userId?: string
  role?: CrmUserRole
}

export type DealsFilterParams = {
  companyId?: string
  stage?: string
  search?: string
  limit?: number
  from?: string
  to?: string
  dealType?: string
  includeDeleted?: boolean
  deletedOnly?: boolean
}

export type PartnerDealCommissionDto = {
  partnerDealGroupId: string
  commissionAmount: string | null
  commissionStatus: PartnerCommissionStatus
  notes: string | null
}

export type DealWithMetadata = typeof deals.$inferSelect & {
  stage?: string | null
  stageLabel?: string | null
  stageColor?: string | null
  documentCount?: number
  createdByName?: string | null
  brandName?: string | null
  catalogItemName?: string | null
  catalogItemType?: string | null
  partnerGroupIds?: string[]
  partnerDealGroupIds?: string[]
  partnerCommissions?: PartnerDealCommissionDto[]
  partnerCommissionAmount?: string | null
}

export type CreateDealData = Omit<typeof deals.$inferInsert, 'stageId' | 'dealTitleNormalized'> & {
  stage?: string | null
  stageId?: string | null
  pricingModel?: unknown
  tierId?: unknown
  partnerGroupIds?: unknown
  partnerDealGroupIds?: unknown
}

export type UpdateDealData = Omit<Partial<typeof deals.$inferInsert>, 'dealTitleNormalized'> & {
  pricingModel?: unknown
  dealTitleNormalized?: unknown
  partnerGroupIds?: unknown
  partnerDealGroupIds?: unknown
}

export type UpsertPartnerDealCommissionData = {
  commissionAmount?: string | number | null
  commissionStatus?: PartnerCommissionStatus
  notes?: string | null
}
