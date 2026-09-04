import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { collectManifest, copyAndVerify, parseArgs } from './migrate-crm-storage.mjs'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'crm-storage-migration-'))
  const source = path.join(root, 'source')
  const destination = path.join(root, 'destination')
  await mkdir(path.join(source, 'deals', 'deal-1', 'notes'), { recursive: true })
  await writeFile(path.join(source, 'MASTER_INDEX.md'), '# CRM\n')
  await writeFile(path.join(source, 'deals', 'deal-1', 'notes', 'note.md'), 'hello\n')
  await writeFile(path.join(source, 'deals', 'deal-1', 'asset.bin'), Buffer.from([0, 1, 2, 255]))
  return {
    root,
    source,
    destination,
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}

test('dry run reports required copies without changing destination', async () => {
  const f = await fixture()
  try {
    const result = await copyAndVerify({ source: f.source, destination: f.destination, dryRun: true, verifyOnly: false })
    assert.equal(result.summary.source.files, 3)
    assert.equal(result.summary.destination.files, 0)
    assert.equal(result.summary.missing, 3)
    assert.equal(result.summary.verified, false)
    assert.equal((await collectManifest(f.destination)).files.length, 0)
  } finally {
    await f.cleanup()
  }
})

test('copy preserves text and binary content and is idempotent', async () => {
  const f = await fixture()
  try {
    const first = await copyAndVerify({ source: f.source, destination: f.destination, dryRun: false, verifyOnly: false })
    assert.equal(first.summary.copied, 3)
    assert.equal(first.summary.verified, true)
    assert.deepEqual(
      await readFile(path.join(f.destination, 'deals', 'deal-1', 'asset.bin')),
      Buffer.from([0, 1, 2, 255]),
    )

    const second = await copyAndVerify({ source: f.source, destination: f.destination, dryRun: false, verifyOnly: false })
    assert.equal(second.summary.copied, 0)
    assert.equal(second.summary.verified, true)
    assert.equal(second.summary.source.digest, second.summary.destination.digest)
  } finally {
    await f.cleanup()
  }
})

test('copy replaces changed destination files but never deletes source files', async () => {
  const f = await fixture()
  try {
    await copyAndVerify({ source: f.source, destination: f.destination, dryRun: false, verifyOnly: false })
    const sourcePath = path.join(f.source, 'deals', 'deal-1', 'notes', 'note.md')
    const destinationPath = path.join(f.destination, 'deals', 'deal-1', 'notes', 'note.md')
    await writeFile(destinationPath, 'stale\n')

    const result = await copyAndVerify({ source: f.source, destination: f.destination, dryRun: false, verifyOnly: false })
    assert.equal(result.summary.copied, 1)
    assert.equal(result.summary.verified, true)
    assert.equal(await readFile(destinationPath, 'utf-8'), 'hello\n')
    assert.equal(await readFile(sourcePath, 'utf-8'), 'hello\n')
  } finally {
    await f.cleanup()
  }
})

test('verify-only rejects missing, changed, or extra destination files', async () => {
  const f = await fixture()
  try {
    await mkdir(f.destination, { recursive: true })
    await writeFile(path.join(f.destination, 'extra.md'), 'unexpected\n')
    await assert.rejects(
      copyAndVerify({ source: f.source, destination: f.destination, dryRun: false, verifyOnly: true }),
      /does not exactly match source/,
    )
    assert.equal(await readFile(path.join(f.destination, 'extra.md'), 'utf-8'), 'unexpected\n')
  } finally {
    await f.cleanup()
  }
})

test('source symlinks fail closed', async () => {
  const f = await fixture()
  try {
    await symlink('MASTER_INDEX.md', path.join(f.source, 'linked-index.md'))
    await assert.rejects(collectManifest(f.source), /Symbolic links are not supported/)
  } finally {
    await f.cleanup()
  }
})

test('source and destination must be separate non-nested directories', () => {
  assert.throws(
    () => parseArgs(['--source', '/tmp/crm', '--destination', '/tmp/crm/child']),
    /separate, non-nested directories/,
  )
  assert.throws(
    () => parseArgs(['--source', '/tmp/crm', '--destination', '/tmp/crm']),
    /separate, non-nested directories/,
  )
})
