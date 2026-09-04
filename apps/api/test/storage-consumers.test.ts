import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { ConfigService } from '@nestjs/config'
import type { Database } from '../src/database/database.types'
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service'
import type { AriaGatewayService } from '../src/common/aria/aria-gateway.service'
import { ContactNotesService } from '../src/contacts/contact-notes.service'
import { DealNotesService } from '../src/deals/deal-notes.service'
import { StorageService } from '../src/storage/storage.service'
import { WikiService } from '../src/wiki/wiki.service'

async function createStorageFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'crm-storage-consumers-'))
  const config = {
    get: <T>(key: string): T | undefined => key === 'CRM_STORAGE_PATH' ? root as T : undefined,
  } as ConfigService
  const storage = new StorageService(config)
  await storage.onModuleInit()
  return { root, storage, cleanup: () => rm(root, { recursive: true, force: true }) }
}

function createDealNotesService(storage: StorageService): DealNotesService {
  return new DealNotesService(
    {} as AuditLogsService,
    {} as Database,
    {} as AriaGatewayService,
    storage,
  )
}

test('deal notes preserve category, content, resource, log, and flat response behavior', async () => {
  const fixture = await createStorageFixture()
  try {
    const dealId = 'deal-1'
    const note = [
      '---',
      'authorId: user-1',
      'createdAt: 2026-09-04T01:00:00.000Z',
      '---',
      '',
      '# Meeting title',
      '',
      'Confirmed scope.',
    ].join('\n')
    await fixture.storage.writeText(`deals/${dealId}/meeting/meeting-1770000000000.md`, note)
    await fixture.storage.writeText(`deals/${dealId}/log.md`, 'log entry')
    await fixture.storage.writeFile(`deals/${dealId}/resources/evidence.bin`, Buffer.from([1, 2, 3]))

    const service = createDealNotesService(fixture.storage)
    const grouped = await service.getNotes(dealId)
    assert.equal(grouped.categories.meeting.length, 1)
    assert.equal(grouped.categories.meeting[0].content, note)
    assert.equal(grouped.log, 'log entry')
    assert.deepEqual(grouped.resources, [{ filename: 'evidence.bin', size: 3, ext: '.bin' }])

    const flat = await service.getNotesFlat(dealId)
    assert.equal(flat.length, 1)
    assert.equal(flat[0].title, 'Meeting title')
    assert.equal(flat[0].authorId, 'user-1')
    assert.equal(flat[0].storagePath, `deals/${dealId}/meeting/meeting-1770000000000.md`)

    assert.equal(
      (await service.readNoteByStoragePath(flat[0].storagePath))?.content,
      note,
    )
  } finally {
    await fixture.cleanup()
  }
})

test('wiki operations and duplicate detection use centralized storage', async () => {
  const fixture = await createStorageFixture()
  try {
    const wiki = new WikiService(fixture.storage)
    await wiki.writePage('deals/deal-1/index.md', '# Deal')
    await wiki.appendPage('deals/deal-1/log.md', 'first\n')
    await wiki.appendPage('deals/deal-1/log.md', 'second\n')

    assert.equal(await wiki.readIndex('deal', 'deal-1'), '# Deal')
    assert.equal(await wiki.readPage('deals/deal-1/log.md'), 'first\nsecond\n')
    assert.equal(await wiki.isDuplicate('deals/deal-1', '# Deal'), true)
    assert.deepEqual(await wiki.listEntityIds('deals'), ['deal-1'])
    assert.deepEqual((await wiki.listMarkdownFiles('deals/deal-1')).sort(), ['index.md', 'log.md'])
    assert.ok(await wiki.statFile('deals/deal-1/index.md'))
  } finally {
    await fixture.cleanup()
  }
})

test('storage metadata extraction preserves markdown and HTML behavior', () => {
  assert.deepEqual(StorageService.extractExcerpt('# Title\n\nHello **world**'), {
    excerpt: 'Title Hello world',
    wordCount: 4,
  })
  assert.deepEqual(StorageService.extractHtmlExcerpt('<style>hidden</style><h1>Hello</h1><p>world</p>'), {
    excerpt: 'Hello world',
    wordCount: 2,
  })
})

test('contact notes preserve note and resource response behavior', async () => {
  const fixture = await createStorageFixture()
  try {
    await fixture.storage.writeText('people/contact-1/general/general-1770000000000.md', '# Note')
    await fixture.storage.writeFile('people/contact-1/resources/photo.png', Buffer.from([1, 2]))

    const result = await new ContactNotesService(fixture.storage).getNotes('contact-1')
    assert.deepEqual(result.categories.general, [{
      filename: 'general-1770000000000.md',
      content: '# Note',
      createdAt: 1770000000000,
    }])
    assert.deepEqual(result.resources, [{ filename: 'photo.png', size: 2, ext: '.png' }])
  } finally {
    await fixture.cleanup()
  }
})
