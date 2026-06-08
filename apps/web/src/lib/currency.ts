import type { ApiDeal, DealCurrency } from '@/lib/types'

export const DEAL_CURRENCIES = ['PHP', 'USD', 'SGD'] as const satisfies readonly DealCurrency[]

export const DEFAULT_DEAL_CURRENCY: DealCurrency = 'PHP'

const CURRENCY_SYMBOLS: Record<DealCurrency, string> = {
  PHP: '₱',
  USD: '$',
  SGD: 'S$',
}

const CURRENCY_LOCALES: Record<DealCurrency, string> = {
  PHP: 'en-PH',
  USD: 'en-US',
  SGD: 'en-SG',
}

export type MoneyInput = {
  value: string | number | null | undefined
  currency?: DealCurrency | null
}

export type CurrencyTotals = Record<DealCurrency, number>

export function normalizeDealCurrency(value: DealCurrency | string | null | undefined): DealCurrency {
  if (!value) return DEFAULT_DEAL_CURRENCY
  const currency = value.toUpperCase() as DealCurrency
  return DEAL_CURRENCIES.includes(currency) ? currency : DEFAULT_DEAL_CURRENCY
}

export function moneyValue(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(value: string | number | null | undefined, currency: DealCurrency | string | null | undefined = DEFAULT_DEAL_CURRENCY): string {
  const amount = moneyValue(value)
  const normalizedCurrency = normalizeDealCurrency(currency)
  return new Intl.NumberFormat(CURRENCY_LOCALES[normalizedCurrency], {
    style: 'currency',
    currency: normalizedCurrency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function formatMoneyShort(value: string | number | null | undefined, currency: DealCurrency | string | null | undefined = DEFAULT_DEAL_CURRENCY): string {
  const amount = moneyValue(value)
  const normalizedCurrency = normalizeDealCurrency(currency)
  const symbol = CURRENCY_SYMBOLS[normalizedCurrency]
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs / 1_000)}K`
  return `${sign}${symbol}${abs.toLocaleString(CURRENCY_LOCALES[normalizedCurrency], { maximumFractionDigits: 0 })}`
}

export function formatDealMoney(deal: Pick<ApiDeal, 'value' | 'currency'>): string {
  const value = moneyValue(deal.value)
  if (value <= 0) return 'No value'
  return formatMoneyShort(value, deal.currency)
}

export function formatDealMoneyFull(deal: Pick<ApiDeal, 'value' | 'currency'>): string {
  const value = moneyValue(deal.value)
  if (value <= 0) return 'No value'
  return formatMoney(value, deal.currency)
}

export function sumMoneyByCurrency(items: MoneyInput[]): CurrencyTotals {
  return items.reduce<CurrencyTotals>((totals, item) => {
    const currency = normalizeDealCurrency(item.currency)
    totals[currency] += moneyValue(item.value)
    return totals
  }, { PHP: 0, USD: 0, SGD: 0 })
}

export function hasMultipleCurrencies(totals: CurrencyTotals): boolean {
  return Object.values(totals).filter(total => total > 0).length > 1
}

export function formatCurrencyBreakdown(totals: CurrencyTotals, options?: { short?: boolean; empty?: string }): string {
  const formatter = options?.short === false ? formatMoney : formatMoneyShort
  const parts = DEAL_CURRENCIES
    .map(currency => ({ currency, total: totals[currency] }))
    .filter(({ total }) => total > 0)
    .map(({ currency, total }) => formatter(total, currency))
  return parts.length > 0 ? parts.join(' + ') : options?.empty ?? 'No value'
}
