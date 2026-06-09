const fs = require('fs')
const path = require('path')

const apiRoot = path.resolve(__dirname, '..')
const scanTargets = [
  path.join(apiRoot, 'src', 'inbound-email'),
  path.join(apiRoot, 'src', 'gmail', 'central-gmail.service.ts'),
]

const forbiddenPatterns = [
  { label: 'gmail.users.messages.send', pattern: /gmail\.users\.messages\.send/ },
  { label: 'messages.send', pattern: /messages\.send/ },
  { label: 'gmail.users.drafts.send', pattern: /gmail\.users\.drafts\.send/ },
  { label: 'drafts.send', pattern: /drafts\.send/ },
  { label: 'GmailService.sendEmail', pattern: /sendEmail\s*\(/ },
  { label: 'gmail send endpoint', pattern: /\/gmail\/send/ },
  { label: 'useSendEmail hook', pattern: /useSendEmail/ },
]

function listFiles(target) {
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target).flatMap(name => listFiles(path.join(target, name)))
}

const files = scanTargets.flatMap(listFiles).filter(file => file.endsWith('.ts'))
const violations = []

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(content)) {
      violations.push({ file: path.relative(apiRoot, file), pattern: forbidden.label })
    }
  }
}

if (violations.length > 0) {
  console.error('Inbound-email no-send regression failed:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: forbidden pattern ${violation.pattern}`)
  }
  process.exit(1)
}

const utilsPath = path.join(apiRoot, 'src', 'gmail', 'gmail-message-utils.ts')
const utilsContent = fs.readFileSync(utilsPath, 'utf8')
const requiredHelpers = [
  'parseGmailMessage',
  'extractRecipientSignals',
  'buildRawDraftMessage',
]

for (const helper of requiredHelpers) {
  if (!utilsContent.includes(`function ${helper}`)) {
    console.error(`Missing expected helper: ${helper}`)
    process.exit(1)
  }
}

console.log(`Inbound-email regression passed: scanned ${files.length} TypeScript files, no send path found.`)
