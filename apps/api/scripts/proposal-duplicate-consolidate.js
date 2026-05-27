const { execFileSync } = require('node:child_process')
const postgres = require('postgres')

const APPLY = process.argv.includes('--apply')
const REQUESTER_DISCORD_ID = process.env.REQUESTER_DISCORD_ID || '1196811987330539601'

function getSecret(name) {
  if (process.env[name]) return process.env[name]
  return execFileSync('python3', [
    '/share/tenants/default/system/skills/_shared/fetch_secret.py',
    name,
    'symph-crm',
  ], { encoding: 'utf8' }).trim()
}

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

function chooseCanonical(rows) {
  return [...rows].sort((a, b) => {
    const versionDelta = Number(b.current_version || 0) - Number(a.current_version || 0)
    if (versionDelta !== 0) return versionDelta
    return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  })[0]
}

async function buildDuplicateGroups(sql) {
  const proposals = await sql`
    SELECT
      p.id,
      p.workspace_id,
      p.deal_id,
      p.title,
      p.current_version,
      p.created_by,
      p.created_at,
      p.updated_at,
      d.title AS deal_title
    FROM proposals p
    LEFT JOIN deals d ON d.id = p.deal_id
    WHERE p.deleted_at IS NULL
      AND p.deal_id IS NOT NULL
    ORDER BY p.deal_id, p.created_at
  `

  const buckets = new Map()
  for (const proposal of proposals) {
    const normalizedTitle = normalizeProposalTitle(proposal.title)
    if (!normalizedTitle) continue
    const key = `${proposal.deal_id}:${normalizedTitle}`
    if (!buckets.has(key)) buckets.set(key, { normalizedTitle, rows: [] })
    buckets.get(key).rows.push(proposal)
  }

  return [...buckets.values()]
    .filter(group => group.rows.length > 1)
    .map(group => {
      const canonical = chooseCanonical(group.rows)
      const duplicates = group.rows
        .filter(row => row.id !== canonical.id)
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      return { ...group, canonical, duplicates }
    })
}

async function resolvePerformer(sql) {
  const [user] = await sql`
    SELECT id, name
    FROM users
    WHERE discord_id = ${REQUESTER_DISCORD_ID}
    LIMIT 1
  `
  if (!user) throw new Error(`No CRM user found for Discord ID ${REQUESTER_DISCORD_ID}`)
  return user
}

async function consolidateGroup(sql, group, performer) {
  const canonicalId = group.canonical.id
  const [canonicalLatest] = await sql`
    SELECT html, change_note, excerpt, word_count, pdf_storage_path, author_id
    FROM proposal_versions
    WHERE proposal_id = ${canonicalId}
      AND version = ${group.canonical.current_version}
    LIMIT 1
  `
  if (!canonicalLatest) throw new Error(`Canonical proposal ${canonicalId} has no latest version`)

  let nextVersion = Number(group.canonical.current_version || 1)
  const insertedVersionIds = []
  const mergedProposalIds = []

  for (const duplicate of group.duplicates) {
    const versions = await sql`
      SELECT html, change_note, excerpt, word_count, pdf_storage_path, author_id, version, created_at
      FROM proposal_versions
      WHERE proposal_id = ${duplicate.id}
      ORDER BY version ASC
    `

    for (const version of versions) {
      nextVersion += 1
      const [inserted] = await sql`
        INSERT INTO proposal_versions (
          proposal_id,
          version,
          html,
          change_note,
          excerpt,
          word_count,
          pdf_storage_path,
          author_id,
          created_at
        ) VALUES (
          ${canonicalId},
          ${nextVersion},
          ${version.html},
          ${`Merged duplicate proposal ${duplicate.id} v${version.version}: ${version.change_note || 'No change note'}`},
          ${version.excerpt},
          ${version.word_count},
          ${version.pdf_storage_path},
          ${version.author_id},
          ${version.created_at}
        )
        RETURNING id
      `
      insertedVersionIds.push(inserted.id)
    }

    await sql`
      UPDATE proposals
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${duplicate.id}
    `
    mergedProposalIds.push(duplicate.id)
  }

  nextVersion += 1
  const [restored] = await sql`
    INSERT INTO proposal_versions (
      proposal_id,
      version,
      html,
      change_note,
      excerpt,
      word_count,
      pdf_storage_path,
      author_id
    ) VALUES (
      ${canonicalId},
      ${nextVersion},
      ${canonicalLatest.html},
      ${'Restored latest canonical proposal after duplicate consolidation.'},
      ${canonicalLatest.excerpt},
      ${canonicalLatest.word_count},
      ${canonicalLatest.pdf_storage_path},
      ${canonicalLatest.author_id}
    )
    RETURNING id
  `
  insertedVersionIds.push(restored.id)

  await sql`
    UPDATE proposals
    SET current_version = ${nextVersion}, updated_at = NOW()
    WHERE id = ${canonicalId}
  `

  await sql`
    INSERT INTO audit_logs (action, audit_type, entity_type, entity_id, source, performed_by, details)
    VALUES (
      'update',
      'proposal_duplicates_consolidated',
      'proposal',
      ${canonicalId},
      'aria',
      ${performer.id},
      ${sql.json({
        canonicalProposalId: canonicalId,
        canonicalTitle: group.canonical.title,
        normalizedTitle: group.normalizedTitle,
        mergedProposalIds,
        insertedVersionIds,
        finalVersion: nextVersion,
      })}
    )
  `

  return {
    dealTitle: group.canonical.deal_title,
    normalizedTitle: group.normalizedTitle,
    canonicalProposalId: canonicalId,
    mergedProposalIds,
    insertedVersionIds,
    finalVersion: nextVersion,
  }
}

async function main() {
  const databaseUrl = getSecret('symph-crm-db-url')
  const sql = postgres(databaseUrl, { ssl: 'require', max: 1 })

  try {
    const performer = await resolvePerformer(sql)
    const groups = await buildDuplicateGroups(sql)

    console.log(`Mode: ${APPLY ? 'apply' : 'dry-run'}`)
    console.log(`Performer: ${performer.name || performer.id}`)
    console.log(`Duplicate groups: ${groups.length}`)

    for (const group of groups) {
      const duplicateVersionCount = group.duplicates.reduce((sum, row) => sum + Number(row.current_version || 1), 0)
      const expectedFinalVersion = Number(group.canonical.current_version || 1) + duplicateVersionCount + 1
      console.log(`${group.canonical.deal_title} | ${group.normalizedTitle} | keep ${group.canonical.id} | merge ${group.duplicates.length} heads | final version ${expectedFinalVersion}`)
    }

    if (!APPLY) {
      console.log('No changes written. Re-run with --apply to consolidate.')
      return
    }

    const results = await sql.begin(async tx => {
      const txGroups = await buildDuplicateGroups(tx)
      const txPerformer = await resolvePerformer(tx)
      const output = []
      for (const group of txGroups) {
        output.push(await consolidateGroup(tx, group, txPerformer))
      }
      return output
    })

    console.log('Consolidation applied.')
    console.log(JSON.stringify(results, null, 2))
  } finally {
    await sql.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
