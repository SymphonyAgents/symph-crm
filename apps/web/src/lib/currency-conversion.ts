import type { DealCurrency } from '@/lib/types'
import { DEAL_CURRENCIES, DEFAULT_DEAL_CURRENCY, formatMoney, formatMoneyShort, moneyValue, normalizeDealCurrency, type MoneyInput } from '@/lib/currency'

export const DISPLAY_CURRENCIES = DEAL_CURRENCIES

export type ReportingExchangeRates = {
  baseCurrency: DealCurrency
  asOf: string
  source: string
  rates: Record<DealCurrency, number>
}

export const REPORTING_EXCHANGE_RATES: ReportingExchangeRates = {
  baseCurrency: 'PHP',
  asOf: '2026-06-10T00:02:31Z',
  source: 'ExchangeRate-API open feed (open.er-api.com)',
  rates: {
    PHP: 1,
    USD: 0.016251,
    SGD: 0.020907,
  },
}

export function convertMoney(
  value: string | number | null | undefined,
  sourceCurrency: DealCurrency | string | null | undefined,
  targetCurrency: DealCurrency | string | null | undefined,
  rates: ReportingExchangeRates = REPORTING_EXCHANGE_RATES,
): number {
  const amount = moneyValue(value)
  if (amount === 0) return 0

  const source = normalizeDealCurrency(sourceCurrency)
  const target = normalizeDealCurrency(targetCurrency ?? DEFAULT_DEAL_CURRENCY)
  const sourceRate = rates.rates[source]
  const targetRate = rates.rates[target]

  if (!sourceRate || !targetRate) return 0

  const amountInBaseCurrency = amount / sourceRate
  return amountInBaseCurrency * targetRate
}

export function sumConvertedMoney(
  items: MoneyInput[],
  targetCurrency: DealCurrency | string | null | undefined,
  rates: ReportingExchangeRates = REPORTING_EXCHANGE_RATES,
): number {
  return items.reduce((total, item) => {
    return total + convertMoney(item.value, item.currency, targetCurrency, rates)
  }, 0)
}

export function formatConvertedMoney(
  value: string | number | null | undefined,
  targetCurrency: DealCurrency | string | null | undefined,
  options?: { short?: boolean; empty?: string },
): string {
  const amount = moneyValue(value)
  if (amount <= 0) return options?.empty ?? 'No value'
  const formatter = options?.short === false ? formatMoney : formatMoneyShort
  return formatter(amount, targetCurrency)
}

export function formatConvertedTotal(
  items: MoneyInput[],
  targetCurrency: DealCurrency | string | null | undefined,
  options?: { short?: boolean; empty?: string },
): string {
  return formatConvertedMoney(sumConvertedMoney(items, targetCurrency), targetCurrency, options)
}

export function formatConversionRateNote(rates: ReportingExchangeRates = REPORTING_EXCHANGE_RATES): string {
  const asOf = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(rates.asOf))

  return `Reporting rates as of ${asOf} UTC from ${rates.source}. Display only.`
}
