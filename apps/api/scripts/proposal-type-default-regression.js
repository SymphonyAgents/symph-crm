const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', 'src', 'proposals', 'proposals.service.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const match = source.match(/export function normalizeProposalTypeForCreate\(type\?: ProposalType \| null\): ProposalType \{[\s\S]*?\n\}/)
assert.ok(match, 'normalizeProposalTypeForCreate export is present')

const harnessSource = [
  "const PROPOSAL_TYPES = ['presentation', 'formal'];",
  "class BadRequestException extends Error {}",
  match[0],
].join('\n')

const compiled = ts.transpileModule(harnessSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2021,
  },
}).outputText

const moduleExports = {}
new Function('exports', `${compiled}`)(moduleExports)
const { normalizeProposalTypeForCreate } = moduleExports

assert.equal(normalizeProposalTypeForCreate(undefined), 'formal')
assert.equal(normalizeProposalTypeForCreate(null), 'formal')
assert.equal(normalizeProposalTypeForCreate('formal'), 'formal')
assert.equal(normalizeProposalTypeForCreate('presentation'), 'presentation')
assert.throws(
  () => normalizeProposalTypeForCreate('deck'),
  /type must be one of: presentation, formal/,
)

console.log('proposal type default regression checks passed')
