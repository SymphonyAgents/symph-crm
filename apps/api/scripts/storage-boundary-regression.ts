import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ConfigService } from '@nestjs/config'
import { StorageService } from '../src/storage/storage.service'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(apiRoot, '..', '..')
const storageSourcePath = path.join(apiRoot, 'src', 'storage', 'storage.service.ts')

function walkTypeScript(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walkTypeScript(entryPath)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [entryPath] : []
  })
}

async function main(): Promise<void> {
  const applicationFiles = walkTypeScript(path.join(apiRoot, 'src'))
  for (const file of applicationFiles) {
    if (file === storageSourcePath) continue
    const source = fs.readFileSync(file, 'utf-8')
    assert.doesNotMatch(source, /(?:from|require\()\s*['"](?:node:)?fs(?:\/promises)?['"]/, `${file} bypasses StorageService`)
    assert.doesNotMatch(source, /\/share\/crm/, `${file} hardcodes the mounted storage path`)
    assert.doesNotMatch(source, /NFS_(?:CRM_PATH|MOUNT_PATH)/, `${file} depends on the retired NFS configuration`)
  }

  const gatewayCallers = [
    ...applicationFiles,
    ...walkTypeScript(path.join(repoRoot, 'apps', 'web', 'src')),
  ]
  for (const file of gatewayCallers) {
    const source = fs.readFileSync(file, 'utf-8')
    assert.doesNotMatch(source, /\/share\/agency\/products\/symph-crm/, `${file} pins CRM chat to the legacy NFS workspace`)
  }

  const cloudbuild = fs.readFileSync(path.join(repoRoot, 'cloudbuild.yaml'), 'utf-8')
  const apiDeploy = cloudbuild.split('id: deploy-api')[1]?.split('id: deploy-web')[0] ?? ''
  assert.match(apiDeploy, /--max-instances=1(?:\s|$)/)
  assert.match(apiDeploy, /CRM_STORAGE_PATH=\/share\/crm/)
  assert.match(apiDeploy, /type=cloud-storage/)
  assert.match(apiDeploy, /mount-path=\/share\/crm/)
  assert.match(apiDeploy, /--clear-network/)
  assert.doesNotMatch(apiDeploy, /CRM_STORAGE_READ_ONLY|NFS_MOUNT_PATH|type=nfs|--network=projects\/symph-aria/)

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'crm-storage-service-'))
  try {
    const config = {
      get: <T>(key: string): T | undefined => key === 'CRM_STORAGE_PATH' ? root as T : undefined,
    } as ConfigService
    const storage = new StorageService(config)
    await storage.onModuleInit()

    await storage.writeText('deals/example/notes/note.md', 'hello')
    assert.equal(await storage.readText('deals/example/notes/note.md'), 'hello')
    assert.equal((await storage.stat('deals/example/notes/note.md'))?.size, 5)
    assert.deepEqual(
      (await storage.listEntries('deals/example/notes')).map(entry => entry.name),
      ['note.md'],
    )

    await Promise.all([
      storage.appendText('log.md', 'first\n'),
      storage.appendText('log.md', 'second\n'),
      storage.appendText('log.md', 'third\n'),
    ])
    assert.equal(await storage.readText('log.md'), 'first\nsecond\nthird\n')

    await storage.writeFile('deals/example/resources/file.bin', Buffer.from([0, 1, 2, 255]))
    assert.deepEqual(await storage.readFile('deals/example/resources/file.bin'), Buffer.from([0, 1, 2, 255]))
    await storage.writeText('..safe.md', 'allowed')
    assert.equal(await storage.readText('..safe.md'), 'allowed')

    await assert.rejects(() => storage.readText('../outside.md'), /escapes the CRM storage root/)
    await assert.rejects(() => storage.writeText('/tmp/outside.md', 'no'), /must be relative/)

    await storage.deleteFile('deals/example/notes/note.md')
    assert.equal(await storage.readText('deals/example/notes/note.md'), null)

    const readOnlyConfig = {
      get: <T>(key: string): T | undefined => {
        if (key === 'CRM_STORAGE_PATH') return root as T
        if (key === 'CRM_STORAGE_READ_ONLY') return 'true' as T
        return undefined
      },
    } as ConfigService
    const readOnlyStorage = new StorageService(readOnlyConfig)
    await readOnlyStorage.onModuleInit()
    assert.equal(await readOnlyStorage.readText('..safe.md'), 'allowed')
    await assert.rejects(() => readOnlyStorage.writeText('blocked.md', 'no'), /temporarily read-only/)
    await assert.rejects(() => readOnlyStorage.appendText('..safe.md', 'no'), /temporarily read-only/)
    await assert.rejects(() => readOnlyStorage.writeFile('blocked.bin', Buffer.from([1])), /temporarily read-only/)
    await assert.rejects(() => readOnlyStorage.deleteFile('..safe.md'), /temporarily read-only/)
    assert.equal(await readOnlyStorage.readText('..safe.md'), 'allowed')
  } finally {
    await fsp.rm(root, { recursive: true, force: true })
  }

  console.log('Storage boundary regression passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
