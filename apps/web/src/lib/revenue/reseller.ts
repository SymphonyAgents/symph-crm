import type { ApiDeal } from '@/lib/types'
import { CLOSED_STAGE_IDS } from '@/lib/constants'

export const RESELLER_PRODUCTS = ['GWS', 'GCP', 'Josys'] as const

export type ResellerProduct = (typeof RESELLER_PRODUCTS)[number]

export type ResellerProductSummary = {
  billing: number
  cost: number
  profit: number
  count: number
}

export type ResellerSummary = {
  activeDeals: ApiDeal[]
  totalBilling: number
  totalCost: number
  grossProfit: number
  avgMargin: number
  byProduct: Record<ResellerProduct, ResellerProductSummary>
}

export function parseRevenueNumber(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatPhp(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function getResellerBillingPrice(deal: ApiDeal): number {
  const cost = parseRevenueNumber(deal.costPrice)
  const margin = parseRevenueNumber(deal.marginPercent)

  if (cost > 0) {
    if (margin > 0 && margin < 100) {
      return cost / (1 - margin / 100)
    }

    return cost
  }

  return parseRevenueNumber(deal.value)
}

export function getResellerCostPrice(deal: ApiDeal): number {
  return parseRevenueNumber(deal.costPrice)
}

export function getResellerGrossProfit(deal: ApiDeal): number {
  return getResellerBillingPrice(deal) - getResellerCostPrice(deal)
}

export function getResellerMargin(deal: ApiDeal): number | null {
  const configuredMargin = parseRevenueNumber(deal.marginPercent)
  if (configuredMargin > 0) return configuredMargin

  const billing = getResellerBillingPrice(deal)
  const cost = getResellerCostPrice(deal)
  if (billing > 0 && cost > 0 && billing > cost) {
    return ((billing - cost) / billing) * 100
  }

  return null
}

export function isActiveResellerDeal(deal: ApiDeal): boolean {
  return !CLOSED_STAGE_IDS.has(deal.stage) && deal.stage !== 'parked'
}

export function getResellerProducts(deal: ApiDeal): ResellerProduct[] {
  return RESELLER_PRODUCTS.filter(product => deal.servicesTags?.includes(product))
}

export function buildResellerSummary(deals: ApiDeal[]): ResellerSummary {
  const activeDeals = deals.filter(isActiveResellerDeal)
  const totalBilling = activeDeals.reduce((sum, deal) => sum + getResellerBillingPrice(deal), 0)
  const totalCost = activeDeals.reduce((sum, deal) => sum + getResellerCostPrice(deal), 0)
  const marginDeals = activeDeals
    .map(getResellerMargin)
    .filter((margin): margin is number => margin !== null)

  const byProduct = RESELLER_PRODUCTS.reduce((acc, product) => {
    acc[product] = { billing: 0, cost: 0, profit: 0, count: 0 }
    return acc
  }, {} as Record<ResellerProduct, ResellerProductSummary>)

  for (const deal of activeDeals) {
    const products = getResellerProducts(deal)
    const targets = products.length > 0 ? products : []

    for (const product of targets) {
      const split = targets.length
      byProduct[product].billing += getResellerBillingPrice(deal) / split
      byProduct[product].cost += getResellerCostPrice(deal) / split
      byProduct[product].profit += getResellerGrossProfit(deal) / split
      byProduct[product].count += 1 / split
    }
  }

  return {
    activeDeals,
    totalBilling,
    totalCost,
    grossProfit: totalBilling - totalCost,
    avgMargin: marginDeals.length > 0
      ? marginDeals.reduce((sum, margin) => sum + margin, 0) / marginDeals.length
      : 0,
    byProduct,
  }
}
