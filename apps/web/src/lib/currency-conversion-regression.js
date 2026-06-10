const assert = require('node:assert/strict')

const rates = {
  baseCurrency: 'PHP',
  asOf: '2026-06-10T00:02:31Z',
  source: 'ExchangeRate-API open feed (open.er-api.com)',
  rates: {
    PHP: 1,
    USD: 0.016251,
    SGD: 0.020907,
  },
}

const currencies = ['PHP', 'USD', 'SGD']
const symbols = { PHP: '₱', USD: '$', SGD: 'S$' }

function normalizeDealCurrency(value) {
  if (!value) return 'PHP'
  const currency = String(value).toUpperCase()
  return currencies.includes(currency) ? currency : 'PHP'
}

function moneyValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoneyShort(value, currency = 'PHP') {
  const amount = moneyValue(value)
  const normalizedCurrency = normalizeDealCurrency(currency)
  const symbol = symbols[normalizedCurrency]
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1000000) return `${sign}${symbol}${(abs / 1000000).toFixed(1)}M`
  if (abs >= 1000) return `${sign}${symbol}${Math.round(abs / 1000)}K`
  return `${sign}${symbol}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function convertMoney(value, sourceCurrency, targetCurrency) {
  const amount = moneyValue(value)
  if (amount === 0) return 0
  const source = normalizeDealCurrency(sourceCurrency)
  const target = normalizeDealCurrency(targetCurrency)
  const amountInBaseCurrency = amount / rates.rates[source]
  return amountInBaseCurrency * rates.rates[target]
}

function sumConvertedMoney(items, targetCurrency) {
  return items.reduce((total, item) => total + convertMoney(item.value, item.currency, targetCurrency), 0)
}

function formatConvertedMoney(value, targetCurrency) {
  const amount = moneyValue(value)
  if (amount <= 0) return 'No value'
  return formatMoneyShort(amount, targetCurrency)
}

assert.equal(convertMoney(1000, 'PHP', 'PHP'), 1000)
assert.equal(Math.round(convertMoney(1000, 'PHP', 'USD') * 100) / 100, 16.25)
assert.equal(Math.round(convertMoney(1000, 'PHP', 'SGD') * 100) / 100, 20.91)
assert.equal(Math.round(convertMoney(100, 'USD', 'PHP')), 6153)
assert.equal(Math.round(convertMoney(100, 'SGD', 'PHP')), 4783)
assert.equal(convertMoney(null, 'USD', 'PHP'), 0)
assert.equal(convertMoney('1,000', 'usd', 'sgd') > 0, true)

const mixed = [
  { value: '1000', currency: 'PHP' },
  { value: '100', currency: 'USD' },
  { value: '100', currency: 'SGD' },
]

assert.equal(Math.round(sumConvertedMoney(mixed, 'PHP')), 11937)
assert.equal(formatConvertedMoney(sumConvertedMoney(mixed, 'USD'), 'USD'), '$194')
assert.equal(formatConvertedMoney(sumConvertedMoney([], 'PHP'), 'PHP'), 'No value')

console.log('currency conversion regression checks passed')
