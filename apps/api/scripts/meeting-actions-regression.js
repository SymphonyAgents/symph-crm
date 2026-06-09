#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const filesToScanForSend = [
  'src/meetings/meeting-actions.service.ts',
  'src/meetings/meeting-action-composer.ts',
  'src/meetings/meetings.controller.ts',
  'src/internal/internal.controller.ts',
]

const forbidden = [
  /messages\.send\s*\(/,
  /drafts\.send\s*\(/,
  /sendEmail\s*\(/,
]

for (const file of filesToScanForSend) {
  const source = read(file)
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      console.error(`Meeting action draft-only regression failed: ${file} matches ${pattern}`)
      process.exit(1)
    }
  }
}

const service = read('src/meetings/meeting-actions.service.ts')
const requiredServiceCalls = [
  'this.dealNotes.upsertNote',
  'this.gmail.createDraft',
  'this.followUpReminders.upsert',
  'meetings.symph.co',
]

for (const token of requiredServiceCalls) {
  if (!service.includes(token)) {
    console.error(`Meeting action service boundary regression failed: missing ${token}`)
    process.exit(1)
  }
}

const composer = read('src/meetings/meeting-action-composer.ts')
const citationTokens = ['Original meeting', 'Meeting summary note', 'Meeting transcript note', 'citations']
for (const token of citationTokens) {
  if (!composer.includes(token)) {
    console.error(`Meeting action citation regression failed: missing ${token}`)
    process.exit(1)
  }
}

console.log('Meeting action regression checks passed')
