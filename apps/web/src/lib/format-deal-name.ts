// Common acronyms and abbreviations that should stay uppercase
const KNOWN_ACRONYMS = new Set([
  'MVP', 'API', 'SLA', 'GDPR', 'CRM', 'B2B', 'B2C', 'KPI', 'ROI', 'OKR',
  'SEO', 'SEM', 'PPC', 'CPC', 'CTR', 'CAC', 'LTV', 'ARR', 'MRR', 'USD',
  'EUR', 'INR', 'AUD', 'GBP', 'JPY', 'CNY', 'PHP', 'KRW', 'IDR', 'VND',
  'AI', 'ML', 'NLP', 'CV', 'RPA', 'ETL', 'BI', 'DL', 'QA', 'IT',
  'VPN', 'SSL', 'TLS', 'HTTP', 'REST', 'JSON', 'XML', 'CSV', 'PDF', 'URL',
  'SDK', 'API', 'CLI', 'IDE', 'UI', 'UX', 'CMS', 'ERP', 'HRM', 'HRIS',
  'RFID', 'IoT', 'AWS', 'GCP', 'Azure', 'SQL', 'NoSQL', 'GPS', 'GSM', 'LTE'
])

/**
 * Format deal name while preserving user capitalization intent and recognizing acronyms.
 *
 * Logic:
 * 1. If word is already ALL_CAPS, preserve it (user chose to emphasize)
 * 2. If word is all-lowercase AND 3-5 chars AND in KNOWN_ACRONYMS list, uppercase it
 * 3. Otherwise preserve exactly what user typed
 *
 * Examples:
 *   "jolly MVP" → "jolly MVP" (MVP already caps, jolly preserved)
 *   "new product launch" → "new product launch" (all lowercase preserved)
 *   "mvp integration" → "MVP integration" (mvp detected as acronym, integration preserved)
 *   "My Deal Name" → "My Deal Name" (mixed case preserved)
 */
export function formatDealName(name: string): string {
  if (!name || typeof name !== 'string') return ''

  return name
    .split(/\s+/) // Split by any whitespace
    .map(word => {
      if (!word) return word

      const isAllCaps = word === word.toUpperCase() && word !== word.toLowerCase()
      const isAllLower = word === word.toLowerCase()
      const isKnownAcronym = KNOWN_ACRONYMS.has(word.toUpperCase())

      // Already capitalized by user (all caps) — preserve
      if (isAllCaps) return word

      // All lowercase, 3-5 chars, and in known acronyms list — uppercase it
      if (isAllLower && word.length >= 3 && word.length <= 5 && isKnownAcronym) {
        return word.toUpperCase()
      }

      // Otherwise preserve exactly as user typed
      return word
    })
    .join(' ')
    .trim()
}
