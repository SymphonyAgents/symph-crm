const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', 'src', 'proposals', 'proposal-html-validation.ts')
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
  Buffer,
}
sandbox.module.exports = sandbox.exports
vm.runInNewContext(compiled, sandbox, { filename: sourcePath })

const { validateProposalHtmlDocument } = sandbox.module.exports

const genericJohndorfShape = `<!doctype html>
<html><head><meta charset="utf-8"><title>Johndorf Ventures Corporation Johndorf HireAI</title>
<style>
body { font-family: Arial, sans-serif; color: #1f2937; max-width: 820px; margin: 40px auto; line-height: 1.5; padding: 0 24px; }
h1 { color: #e8552a; border-bottom: 2px solid #e8552a; padding-bottom: 8px; margin-top: 32px; }
</style></head><body><h1>Agreement and Signature</h1><p>Plain proposal body.</p></body></html>`

assert.throws(
  () => validateProposalHtmlDocument(genericJohndorfShape),
  /Proposal HTML failed quality gate.*A4 page wrappers.*canonical print media block.*A4 print page size.*print color adjustment.*proposal page breaks/,
)

const validProposalBuilderShape = `<!doctype html>
<html><head><meta charset="utf-8"><title>Proposal</title>
<style>
@page { size: A4 portrait; margin: 0; }
.page { width: 210mm; min-height: 297mm; page-break-after: always; }
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .page { height: 297mm !important; break-after: page !important; }
}
</style></head><body><div class="page"><h1>Proposal</h1></div></body></html>`

assert.doesNotThrow(() => validateProposalHtmlDocument(validProposalBuilderShape))

console.log('proposal html validation regression checks passed')
