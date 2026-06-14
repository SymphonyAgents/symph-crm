// Common acronyms and abbreviations that should stay uppercase.
export const KNOWN_ACRONYMS = new Set([
  'MVP', 'API', 'SLA', 'GDPR', 'CRM', 'B2B', 'B2C', 'KPI', 'ROI', 'OKR',
  'SEO', 'SEM', 'PPC', 'CPC', 'CTR', 'CAC', 'LTV', 'ARR', 'MRR', 'USD',
  'EUR', 'INR', 'AUD', 'GBP', 'JPY', 'CNY', 'PHP', 'KRW', 'IDR', 'VND',
  'AI', 'ML', 'NLP', 'CV', 'RPA', 'ETL', 'BI', 'DL', 'QA', 'IT',
  'VPN', 'SSL', 'TLS', 'HTTP', 'REST', 'JSON', 'XML', 'CSV', 'PDF', 'URL',
  'SDK', 'API', 'CLI', 'IDE', 'UI', 'UX', 'CMS', 'ERP', 'HRM', 'HRIS',
  'RFID', 'IoT', 'AWS', 'GCP', 'Azure', 'SQL', 'NoSQL', 'GPS', 'GSM', 'LTE',
  'APAC', 'CMGN', 'CPS', 'SG'
])

type FormatNameOptions = {
  acronymMinLength?: number
  acronymMaxLength?: number
  knownAcronymsOnly?: boolean
  pascalCaseFallback?: boolean
  excludedAcronyms?: Set<string>
}

function splitWordToken(word: string): { prefix: string; core: string; suffix: string } {
  const match = word.match(/^(\W*)([\p{L}\p{N}]+(?:[&'.-][\p{L}\p{N}]+)*)(\W*)$/u)
  if (!match) return { prefix: '', core: word, suffix: '' }
  return { prefix: match[1] ?? '', core: match[2] ?? word, suffix: match[3] ?? '' }
}

function toPascalWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export function formatNameWithAcronyms(name: string, options: FormatNameOptions = {}): string {
  if (!name || typeof name !== 'string') return ''

  const {
    acronymMinLength = 3,
    acronymMaxLength = 5,
    knownAcronymsOnly = true,
    pascalCaseFallback = false,
    excludedAcronyms = new Set<string>(),
  } = options

  return name
    .split(/(\s+)/)
    .map(part => {
      if (!part.trim()) return part

      const { prefix, core, suffix } = splitWordToken(part)
      if (!core) return part

      const upperCore = core.toUpperCase()
      const lowerCore = core.toLowerCase()
      const isAllCaps = core === upperCore && core !== lowerCore
      const isAllLower = core === lowerCore
      const isKnownAcronym = KNOWN_ACRONYMS.has(upperCore)
      const isExcludedAcronym = excludedAcronyms.has(lowerCore)
      const isAcronymLength = core.length >= acronymMinLength && core.length <= acronymMaxLength

      if (isAllCaps) return part

      if (isAllLower && isAcronymLength && !isExcludedAcronym && (!knownAcronymsOnly || isKnownAcronym)) {
        return `${prefix}${upperCore}${suffix}`
      }

      if (pascalCaseFallback && isAllLower) {
        return `${prefix}${toPascalWord(core)}${suffix}`
      }

      return part
    })
    .join('')
    .trim()
}

// Format deal name while preserving user capitalization intent and recognizing known acronyms.
export function formatDealName(name: string): string {
  return formatNameWithAcronyms(name, {
    acronymMinLength: 3,
    acronymMaxLength: 5,
    knownAcronymsOnly: true,
    pascalCaseFallback: false,
  })
}
