const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const CRM_BASE = process.env.CRM_BASE || 'https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api/internal'
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(__dirname, '..', 'tmp', 'proposal-duplicate-consolidation-dry-run.json')

function getSecret() {
  if (process.env.SYMPH_CRM_INTERNAL_SECRET) return process.env.SYMPH_CRM_INTERNAL_SECRET
  return execFileSync('python3', [
    '/share/tenants/default/system/skills/_shared/fetch_secret.py',
    'symph-crm-internal-secret',
    'symph-crm',
  ], { encoding: 'utf8' }).trim()
}

const INTERNAL_SECRET = getSecret()

function normalizeProposalTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(new RegExp('[\\u2010-\\u2015]', 'g'), '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function getJson(pathname) {
  const res = await fetch(`${CRM_BASE}${pathname}`, {
    headers: { 'X-Internal-Secret': INTERNAL_SECRET },
  })
  if (!res.ok) throw new Error(`${pathname} returned ${res.status}: ${await res.text()}`)
  return res.json()
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.rows)) return payload.rows
  if (Array.isArray(payload.deals)) return payload.deals
  if (Array.isArray(payload.proposals)) return payload.proposals
  return []
}

function chooseCanonical(rows) {
  return [...rows].sort((a, b) => {
    const versionDelta = Number(b.currentVersion || 0) - Number(a.currentVersion || 0)
    if (versionDelta !== 0) return versionDelta
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  })[0]
}

async function main() {
  const dealsPayload = await getJson('/deals?limit=500&sortBy=createdAt&sortOrder=desc')
  const deals = asArray(dealsPayload)
  const groups = []

  for (const deal of deals) {
    if (!deal.id) continue
    const proposalRows = asArray(await getJson(`/deals/${encodeURIComponent(deal.id)}/proposals`))
    const byTitle = new Map()
    for (const proposal of proposalRows) {
      const normalizedTitle = normalizeProposalTitle(proposal.title)
      if (!normalizedTitle) continue
      const key = `${deal.id}:${normalizedTitle}`
      if (!byTitle.has(key)) byTitle.set(key, [])
      byTitle.get(key).push(proposal)
    }

    for (const [key, rows] of byTitle.entries()) {
      if (rows.length < 2) continue
      const canonical = chooseCanonical(rows)
      const duplicates = rows
        .filter(row => row.id !== canonical.id)
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      const duplicateVersionCount = duplicates.reduce((sum, row) => sum + Number(row.currentVersion || 1), 0)
      const restoreCanonicalLatestVersion = duplicateVersionCount > 0
      const expectedFinalVersionCount = Number(canonical.currentVersion || 1) + duplicateVersionCount + (restoreCanonicalLatestVersion ? 1 : 0)
      groups.push({
        dealId: deal.id,
        dealTitle: deal.title || deal.name || null,
        normalizedTitle: key.split(':').slice(1).join(':'),
        canonical: {
          id: canonical.id,
          title: canonical.title,
          currentVersion: canonical.currentVersion,
          createdAt: canonical.createdAt,
          updatedAt: canonical.updatedAt,
        },
        duplicates: duplicates.map(row => ({
          id: row.id,
          title: row.title,
          currentVersion: row.currentVersion,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        duplicateVersionCount,
        restoreCanonicalLatestVersion,
        expectedFinalVersionCount,
        action: 'append duplicate versions to canonical, append canonical latest again, then soft-delete duplicate heads',
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dealsScanned: deals.length,
    duplicateGroups: groups.length,
    groups,
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2))
  console.log(`Duplicate groups: ${groups.length}`)
  console.log(`Dry-run report: ${OUTPUT_PATH}`)
  for (const group of groups) {
    console.log(`${group.dealTitle} | ${group.normalizedTitle} | keep ${group.canonical.id} | merge ${group.duplicates.length} heads | final versions ${group.expectedFinalVersionCount}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
