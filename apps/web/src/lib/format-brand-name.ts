import { formatNameWithAcronyms } from './format-deal-name'

const LEGAL_SUFFIXES = new Set([
  'co',
  'corp',
  'corporation',
  'inc',
  'incorporated',
  'ltd',
  'limited',
  'llc',
  'llp',
  'plc',
  'pte',
  'gmbh',
])

// Format brand names by preserving user capitalization, uppercasing known short acronyms,
// and PascalCasing plain lowercase words. Legal suffixes stay title-cased.
export function formatBrandName(name: string): string {
  return formatNameWithAcronyms(name, {
    acronymMinLength: 2,
    acronymMaxLength: 5,
    knownAcronymsOnly: true,
    pascalCaseFallback: true,
    excludedAcronyms: LEGAL_SUFFIXES,
  })
}
