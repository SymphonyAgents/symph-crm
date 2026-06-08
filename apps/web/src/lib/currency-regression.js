const assert = require('node:assert/strict')

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

function sumMoneyByCurrency(items) {
  return items.reduce((totals, item) => {
    const currency = normalizeDealCurrency(item.currency)
    totals[currency] += moneyValue(item.value)
    return totals
  }, { PHP: 0, USD: 0, SGD: 0 })
}

function formatCurrencyBreakdown(totals) {
  return currencies
    .map(currency => ({ currency, total: totals[currency] }))
    .filter(({ total }) => total > 0)
    .map(({ currency, total }) => formatMoneyShort(total, currency))
    .join(' + ') || 'No value'
}

assert.equal(normalizeDealCurrency(undefined), 'PHP')
assert.equal(normalizeDealCurrency(null), 'PHP')
assert.equal(normalizeDealCurrency('usd'), 'USD')
assert.equal(normalizeDealCurrency('EUR'), 'PHP')
assert.equal(moneyValue('1,234.50'), 1234.5)
assert.equal(formatMoneyShort(1500000, 'PHP'), '₱1.5M')
assert.equal(formatMoneyShort(12000, 'USD'), '$12K')
assert.equal(formatMoneyShort(9000, 'SGD'), 'S$9K')
assert.deepEqual(sumMoneyByCurrency([
  { value: '1000', currency: 'PHP' },
  { value: '2000', currency: null },
  { value: '3000', currency: 'USD' },
  { value: '4000', currency: 'SGD' },
]), { PHP: 3000, USD: 3000, SGD: 4000 })
assert.equal(formatCurrencyBreakdown({ PHP: 3000, USD: 3000, SGD: 4000 }), '₱3K + $3K + S$4K')

console.log('currency regression checks passed')
