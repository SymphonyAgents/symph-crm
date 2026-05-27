const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const sourcePath = path.join(__dirname, '..', 'src', 'proposals', 'proposals.service.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const match = source.match(/export function normalizeProposalTitleForDuplicateCheck\(title: string\) \{[\s\S]*?\n\}/)
assert.ok(match, 'normalizeProposalTitleForDuplicateCheck export is present')
const jsSource = match[0]
  .replace('export function', 'function')
  .replace('title: string', 'title')
const normalizeProposalTitleForDuplicateCheck = new Function(`${jsSource}; return normalizeProposalTitleForDuplicateCheck`)()

assert.equal(
  normalizeProposalTitleForDuplicateCheck(' SocialPost AI - SocialPost AI '),
  'socialpost-ai-socialpost-ai',
)
assert.equal(
  normalizeProposalTitleForDuplicateCheck('SocialPost AI: SocialPost AI'),
  'socialpost-ai-socialpost-ai',
)
assert.equal(
  normalizeProposalTitleForDuplicateCheck('Chelsea Shipping & Data Readiness'),
  'chelsea-shipping-and-data-readiness',
)
assert.equal(
  normalizeProposalTitleForDuplicateCheck(`AlfaConstruct ${String.fromCharCode(0x2013)} AlfaConSys v2`),
  'alfaconstruct-alfaconsys-v2',
)
assert.equal(
  normalizeProposalTitleForDuplicateCheck('AlfaConstruct, AlfaConSys v2'),
  'alfaconstruct-alfaconsys-v2',
)

console.log('proposal duplicate guard regression checks passed')
