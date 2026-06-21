import { normalizeDealCurrency } from '@/lib/currency'
import type { DealCurrency } from '@/lib/types'

export type CreateDealPayloadInput = {
  title: string
  companyId: string | null
  stage: string
  value: string
  currency: DealCurrency
  outreachCategory: string
  pricingModel: string
  serviceType: string
  userId?: string | null
  assignedToId: string
  subAccountManagerId: string
  builders: string[]
  partnerDealGroupIds: string[]
  catalogItemId: string
  defaultDealType?: string
}

export type DealUpdatePayloadInput = {
  deal: {
    title: string
    stage?: string | null
    value?: string | null
    currency?: string | null
    oneTimeFee?: string | null
    mrr?: string | null
    costPrice?: string | null
    marginPercent?: string | null
    contractLength?: number | null
    outreachCategory?: string | null
    servicesTags?: string[] | null
    closeDate?: string | null
    subAccountManagerId?: string | null
    builders?: string[] | null
    partnerDealGroupIds?: string[] | null
    catalogItemId?: string | null
  }
  title: string
  stage?: string | null
  value: string
  currency: DealCurrency
  oneTimeFee: string
  mrr: string
  costPrice: string
  marginPercent: string
  contractLength: string
  outreachCategory: string
  serviceType: string
  closeDate: string
  subAccountManagerId: string
  builders: string[]
  partnerDealGroupIds: string[]
  catalogItemId: string
}

export function cleanMoneyInput(value: string) {
  return value.replace(/,/g, '').trim() || null
}

export function buildCreateDealPayload(input: CreateDealPayloadInput) {
  const tags = input.serviceType ? [input.serviceType] : []

  return {
    title: input.title.trim(),
    companyId: input.companyId,
    productId: null,
    tierId: null,
    stage: input.stage,
    value: cleanMoneyInput(input.value),
    currency: input.currency,
    outreachCategory: input.outreachCategory || null,
    pricingModel: input.pricingModel || null,
    servicesTags: tags,
    createdBy: input.userId,
    assignedTo: input.assignedToId || input.userId,
    subAccountManagerId: input.subAccountManagerId || null,
    builders: input.builders.length > 0 ? input.builders : undefined,
    partnerDealGroupIds: input.partnerDealGroupIds,
    catalogItemId: input.serviceType === 'internal_products' ? (input.catalogItemId || null) : null,
    dealType: input.defaultDealType ?? 'agency',
  }
}

export function buildDealUpdatePayload(input: DealUpdatePayloadInput) {
  const changes: Record<string, unknown> = {}

  if (input.title.trim() !== input.deal.title) changes.title = input.title.trim()
  if (input.stage !== input.deal.stage) changes.stage = input.stage
  if (input.currency !== normalizeDealCurrency(input.deal.currency)) changes.currency = input.currency

  const cleanValue = cleanMoneyInput(input.value)
  if (cleanValue !== input.deal.value) changes.value = cleanValue

  const cleanOneTimeFee = cleanMoneyInput(input.oneTimeFee)
  if (cleanOneTimeFee !== (input.deal.oneTimeFee ?? null)) changes.oneTimeFee = cleanOneTimeFee

  const cleanMrr = cleanMoneyInput(input.mrr)
  if (cleanMrr !== (input.deal.mrr ?? null)) changes.mrr = cleanMrr

  const cleanCostPrice = cleanMoneyInput(input.costPrice)
  if (cleanCostPrice !== (input.deal.costPrice ?? null)) changes.costPrice = cleanCostPrice

  const cleanMarginPercent = input.marginPercent.trim() || null
  if (cleanMarginPercent !== (input.deal.marginPercent ?? null)) changes.marginPercent = cleanMarginPercent

  const cleanContractLength = input.contractLength ? parseInt(input.contractLength, 10) || null : null
  if (cleanContractLength !== (input.deal.contractLength ?? null)) changes.contractLength = cleanContractLength

  if ((input.outreachCategory || null) !== (input.deal.outreachCategory || null)) {
    changes.outreachCategory = input.outreachCategory || null
  }

  const newTags = input.serviceType ? [input.serviceType] : []
  const oldTags = input.deal.servicesTags ?? []
  if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
    changes.servicesTags = newTags
  }

  const newCloseDate = input.closeDate || null
  const oldCloseDate = input.deal.closeDate ? input.deal.closeDate.slice(0, 10) : null
  if (newCloseDate !== oldCloseDate) changes.closeDate = newCloseDate

  const newSubAm = input.subAccountManagerId || null
  if (newSubAm !== (input.deal.subAccountManagerId ?? null)) changes.subAccountManagerId = newSubAm

  const oldBuilders = input.deal.builders ?? []
  if (JSON.stringify(input.builders) !== JSON.stringify(oldBuilders)) {
    changes.builders = input.builders
  }

  const oldPartnerDealGroupIds = input.deal.partnerDealGroupIds ?? []
  if (JSON.stringify([...input.partnerDealGroupIds].sort()) !== JSON.stringify([...oldPartnerDealGroupIds].sort())) {
    changes.partnerDealGroupIds = input.partnerDealGroupIds
  }

  const newCatalogItemId = input.serviceType === 'internal_products' ? (input.catalogItemId || null) : null
  if (newCatalogItemId !== (input.deal.catalogItemId ?? null)) {
    changes.catalogItemId = newCatalogItemId
  }

  return changes
}
