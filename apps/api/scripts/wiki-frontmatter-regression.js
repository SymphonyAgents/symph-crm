const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', 'src', 'wiki', 'wiki-frontmatter.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2021,
  },
}).outputText

const sandbox = {
  exports: {},
  require,
  module: { exports: {} },
}
sandbox.module.exports = sandbox.exports
vm.runInNewContext(compiled, sandbox, { filename: sourcePath })

const {
  ensureDealNoteAuthorFrontmatter,
  isDealNoteMarkdownPath,
} = sandbox.module.exports

const authorId = '241d1b1a-3ca2-403b-9b65-86c978a2a187'
const submittedAt = new Date('2026-05-21T08:22:46.000Z')

const rawNote = '# Discovery Call: SDE.NO - Raw Transcript\n\nSource: Symph Meetings'
const attributed = ensureDealNoteAuthorFrontmatter(
  'deals/8609fd6d-cd31-4d0b-9b78-56d123864207/meeting/20260521T082246Z-transcript_raw.md',
  rawNote,
  authorId,
  submittedAt,
)

assert.equal(isDealNoteMarkdownPath('deals/deal-1/meeting/note.md'), true)
assert.equal(isDealNoteMarkdownPath('companies/company-1/index.md'), false)
assert.match(attributed, /^---\nauthorId: 241d1b1a-3ca2-403b-9b65-86c978a2a187\n/m)
assert.match(attributed, /^crm_user_id: 241d1b1a-3ca2-403b-9b65-86c978a2a187\n/m)
assert.match(attributed, /^submitted_at: 2026-05-21T08:22:46.000Z\n/m)
assert.match(attributed, /\n---\n\n# Discovery Call: SDE.NO - Raw Transcript/)

const existingFrontmatter = '---\ntype: "discovery"\n---\n\n# Note'
const enrichedFrontmatter = ensureDealNoteAuthorFrontmatter(
  'deals/deal-1/discovery/note.md',
  existingFrontmatter,
  authorId,
  submittedAt,
)

assert.match(enrichedFrontmatter, /^---\nauthorId: 241d1b1a-3ca2-403b-9b65-86c978a2a187\ncrm_user_id:/)
assert.match(enrichedFrontmatter, /type: "discovery"/)

const alreadyAttributed = '---\nauthorId: existing-user\n---\n\n# Note'
assert.equal(
  ensureDealNoteAuthorFrontmatter('deals/deal-1/notes/note.md', alreadyAttributed, authorId, submittedAt),
  alreadyAttributed,
)

const nonDealContent = '# Company note'
assert.equal(
  ensureDealNoteAuthorFrontmatter('companies/company-1/index.md', nonDealContent, authorId, submittedAt),
  nonDealContent,
)

console.log('wiki frontmatter regression checks passed')
