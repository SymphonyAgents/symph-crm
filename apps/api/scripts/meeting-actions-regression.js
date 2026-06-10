#!/usr/bin/env node
const fs = require('fs')
const os = require('os')
const path = require('path')
const ts = require('typescript')

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

const composerSource = read('src/meetings/meeting-action-composer.ts')
const citationTokens = ['Original meeting', 'Meeting summary note', 'Meeting transcript note', 'citations']
for (const token of citationTokens) {
  if (!composerSource.includes(token)) {
    console.error(`Meeting action citation regression failed: missing ${token}`)
    process.exit(1)
  }
}

const qualityTokens = [
  'AI_SLOP_PATTERN',
  'isFragment',
  'isPlaceholderDealTitle',
  'Here are my key takeaways',
  'Proposed next steps',
]
for (const token of qualityTokens) {
  if (!composerSource.includes(token)) {
    console.error(`Meeting action quality regression failed: missing ${token}`)
    process.exit(1)
  }
}

if ([...composerSource].some((char) => char.charCodeAt(0) === 0x2014)) {
  console.error('Meeting action anti-slop regression failed: composer contains an em dash')
  process.exit(1)
}

const compiled = ts.transpileModule(composerSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-action-regression-'))
process.on('exit', () => fs.rmSync(tempDir, { recursive: true, force: true }))
const tempFile = path.join(tempDir, 'meeting-action-composer.js')
fs.writeFileSync(tempFile, compiled)
const composer = require(tempFile)

const dashVariant = String.fromCharCode(0x2014)
const mpicSummary = `---
title: MPIC GCP to Azure Technical Sync
---
# Meeting Summary - MPIC GCP to Azure Technical Sync

## Overview
The team aligned on presenting MPIC with **3** options for the GCP-to-Azure migration question: keep GCP with direct billing to MPIC, Symph handles the migration, or MPIC's team does it themselves.
Raven assessed the migration as technically feasible but flagged BigQuery as the biggest risk ${dashVariant} since there is no direct Azure equivalent and a full migration including BigQuery would require about **2** weeks of dev work and retesting.
The team is not trying to stop MPIC from migrating ${dashVariant} the goal is to lay out all the facts, costs, and effort so MPIC can make an informed decision.
Chelle and Paul raised that the engagement is no longer sustainable revenue-wise, and there is an open question about whether to use this as a graceful exit or pursue one last SOW.
Ems will estimate what percentage of GCP costs BigQuery accounts for to help inform the decision.

## Why MPIC wants to migrate
`

const noisyTranscript = `Paul Gonia: And share ka nga ng views mo dyan.
Christopher Cheng: it. Send Anna. Yearly Anna.
Ems Oriel: I will estimate the BigQuery share of the monthly GCP cost so we can show MPIC the real cost driver.
Raven Duran: We should prepare the options note with the migration effort, BigQuery risk, and billing handoff option.
Jarrhey De la Pena: I would say that's how I would play it out in my head, but the big prerequisite talaga is if you can explain how it's not that straightforward, which I think is where the bulk of the work will be.
Raven Duran: But then pretty soon they will realize, if they do not really have the capability, because I do not exactly know what their capability is, then they will just realize it is too much effort and we either pay Symph or continue with GCP.
`

const actions = composer.extractMeetingActionItems(mpicSummary, noisyTranscript)
const summary = composer.getMeetingContentSummary(mpicSummary, noisyTranscript)
const actionPackage = composer.composeMeetingActionPackage({
  meeting: {
    id: 'meeting-1',
    title: 'MPIC GCP to Azure Technical Sync',
    sourceUrl: 'https://meetings.symph.co/meetings/9450638',
    attendees: ['dave@symph.co', 'raven@symph.co', 'ems@symph.co', 'mpic.client@example.com'],
    attendeeDetails: [
      { email: 'dave@symph.co', name: 'Dave Overton', avatarUrl: null },
      { email: 'raven@symph.co', name: 'Raven Duran', avatarUrl: null },
      { email: 'ems@symph.co', name: 'Ems Oriel', avatarUrl: null },
      { email: 'mpic.client@example.com', name: 'MPIC Client', avatarUrl: null },
      { email: 'aria@symph.co', name: 'Aria', avatarUrl: null },
    ],
    startedAt: new Date('2026-06-09T03:30:00.000Z'),
    summaryNotePath: 'summary.md',
    transcriptNotePath: 'transcript.md',
  },
  summaryText: mpicSummary,
  transcriptText: noisyTranscript,
  dealTitle: 'Test Lead - MPIC Meeting Action Engine',
  generatedAt: new Date('2026-06-10T00:00:00.000Z'),
  generatedBy: 'dave',
  confirmedDealId: 'deal-1',
})

const internalOnlyActionPackage = composer.composeMeetingActionPackage({
  meeting: {
    id: 'meeting-2',
    title: 'Internal MPIC Follow-Up',
    sourceUrl: 'https://meetings.symph.co/meetings/9450639',
    attendees: ['Dave Overton <dave@symph.co>', 'Raven Duran <raven@symph.co>', 'aria@symph.co'],
    startedAt: new Date('2026-06-09T04:30:00.000Z'),
    summaryNotePath: 'summary.md',
    transcriptNotePath: 'transcript.md',
  },
  summaryText: mpicSummary,
  transcriptText: noisyTranscript,
  dealTitle: 'Internal MPIC Follow-Up',
  generatedAt: new Date('2026-06-10T00:00:00.000Z'),
  generatedBy: 'dave',
  confirmedDealId: 'deal-1',
})

const bannedDraftPatterns = [
  /Here is the quick recap/i,
  /Please confirm if this matches your understanding/i,
  /turn this into the next client-facing note/i,
  /^Hi,\s*$/m,
  /Test Lead -/i,
  /unlock the power/i,
  /in today's fast-paced world/i,
]

for (const pattern of bannedDraftPatterns) {
  if (pattern.test(actionPackage.followUpDraftText)) {
    console.error(`Meeting action anti-slop regression failed: draft matches ${pattern}`)
    process.exit(1)
  }
}

if ([...actionPackage.followUpDraftText].some((char) => char.charCodeAt(0) === 0x2014)) {
  console.error('Meeting action anti-slop regression failed: draft contains an em dash')
  process.exit(1)
}

const bannedActionFragments = [
  /And share ka nga/i,
  /Send Anna/i,
  /^it\./i,
  /Jarrhey De la Pena/i,
  /Raven Duran: But then/i,
  /^Option\s+2/i,
]

for (const pattern of bannedActionFragments) {
  if (actions.some((action) => pattern.test(action))) {
    console.error(`Meeting action fragment regression failed: action item matches ${pattern}`)
    process.exit(1)
  }
}

if (!actions.some((action) => /BigQuery/i.test(action))) {
  console.error('Meeting action quality regression failed: expected a BigQuery action item')
  process.exit(1)
}

if (!actions.some((action) => /Prepare the MPIC options note|options note|migration effort|billing handoff/i.test(action))) {
  console.error('Meeting action quality regression failed: expected an options-note action item')
  process.exit(1)
}

if (/Meeting Summary -|^Overview$/m.test(summary)) {
  console.error('Meeting action summary regression failed: summary includes markdown heading noise')
  process.exit(1)
}

const requiredDraftTokens = [
  'Hi, MPIC Client,',
  'Thanks for the meeting. I appreciate the discussion, and here are my notes.',
  'Meeting title: MPIC GCP to Azure Technical Sync',
  'Date/time: June 9, 2026',
  'Here are my key takeaways',
  'Summary:',
  'Proposed next steps:',
]

for (const token of requiredDraftTokens) {
  if (!actionPackage.followUpDraftText.includes(token)) {
    console.error(`Meeting action sendable-note regression failed: missing ${token}`)
    process.exit(1)
  }
}

if (!internalOnlyActionPackage.followUpDraftText.startsWith('Hi, Raven Duran,')) {
  console.error('Meeting action sendable-note regression failed: internal fallback greeting should exclude sender and system attendee')
  process.exit(1)
}

if (/Hi,.*Dave Overton|Hi,.*Aria/i.test(internalOnlyActionPackage.followUpDraftText)) {
  console.error('Meeting action sendable-note regression failed: internal fallback greeting includes sender or system attendee')
  process.exit(1)
}

if (/\?\s*(Best,)?\s*Dave\s*$/i.test(actionPackage.followUpDraftText)) {
  console.error('Meeting action sendable-note regression failed: draft ends with a question')
  process.exit(1)
}

console.log('Meeting action regression checks passed')
