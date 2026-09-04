import * as fs from 'fs/promises'
import * as path from 'path'
import { BadRequestException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { extractExcerpt, extractHtmlExcerpt } from './storage-content-metadata'

export const ATTACHMENTS_BUCKET = 'attachments'
export const CATALOG_ICONS_BUCKET = 'catalog-icons'

export type StorageEntry = {
  name: string
  isDirectory: boolean
  size: number
  modifiedAt: Date
}

export type StorageStat = {
  size: number
  modifiedAt: Date
  isDirectory: boolean
}

/**
 * StorageService owns every filesystem operation for CRM-managed content.
 *
 * Production mounts the private CRM Cloud Storage bucket at CRM_STORAGE_PATH
 * through Cloud Storage FUSE. Local development can use any writable directory.
 * Voice recordings, signed proposal PDFs, and public catalog icons remain in
 * their existing Supabase Storage buckets. `readMarkdown` retains the existing
 * legacy `content` bucket fallback until DB pointers are reconciled after cutover.
 *
 * The mounted store has a single-writer deployment contract: Cloud Run must
 * remain at max-instances=1. This process-local queue serializes operations on
 * the same path inside that instance. Scaling beyond one instance requires a
 * cross-instance lock or object-generation compare-and-swap before rollout.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private readonly storageRoot: string
  private readonly readOnly: boolean
  private readonly pendingPathOperations = new Map<string, Promise<void>>()
  private supabase: SupabaseClient | null = null

  constructor(private config: ConfigService) {
    const configuredPath = config.get<string>('CRM_STORAGE_PATH')
    if (!configuredPath) {
      throw new Error(
        'CRM_STORAGE_PATH is required but not set.\n' +
        '  Production:  CRM_STORAGE_PATH=/share/crm\n' +
        '  Local dev:   CRM_STORAGE_PATH=/path/to/your/local-vault',
      )
    }
    this.storageRoot = path.resolve(configuredPath)
    this.readOnly = config.get<string>('CRM_STORAGE_READ_ONLY')?.toLowerCase() === 'true'

    const url = config.get<string>('SUPABASE_URL')
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) {
      this.supabase = createClient(url, key, { auth: { persistSession: false } })
      this.logger.log('Supabase Storage initialized for voice, signed PDFs, and catalog icons')
    } else {
      this.logger.warn('SUPABASE_SERVICE_ROLE_KEY not configured; Supabase-backed file storage is disabled')
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await fs.mkdir(this.storageRoot, { recursive: true })
      await fs.access(this.storageRoot, this.readOnly ? fs.constants.R_OK : fs.constants.R_OK | fs.constants.W_OK)
      this.logger.log(`CRM storage ready at ${this.storageRoot}${this.readOnly ? ' (read-only)' : ''}`)
    } catch (error: unknown) {
      throw new Error(
        `CRM storage at ${this.storageRoot} is not accessible: ${this.errorMessage(error)}\n` +
        'Check that CRM_STORAGE_PATH is mounted and writable.',
      )
    }
  }

  private get supabaseClient(): SupabaseClient {
    if (!this.supabase) throw new Error('Supabase Storage is not configured')
    return this.supabase
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private errorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }

  private assertWritable(): void {
    if (this.readOnly) {
      throw new ServiceUnavailableException('CRM content storage is temporarily read-only')
    }
  }

  private resolvePath(storagePath: string): string {
    if (path.isAbsolute(storagePath)) {
      throw new BadRequestException('Storage path must be relative')
    }

    const resolved = path.resolve(this.storageRoot, storagePath)
    const relative = path.relative(this.storageRoot, resolved)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new BadRequestException('Storage path escapes the CRM storage root')
    }
    return resolved
  }

  private async serializePath<T>(storagePath: string, operation: () => Promise<T>): Promise<T> {
    const key = this.resolvePath(storagePath)
    const previous = this.pendingPathOperations.get(key) ?? Promise.resolve()
    const run = previous.catch(() => undefined).then(operation)
    const completion = run.then(() => undefined, () => undefined)
    this.pendingPathOperations.set(key, completion)

    try {
      return await run
    } finally {
      if (this.pendingPathOperations.get(key) === completion) {
        this.pendingPathOperations.delete(key)
      }
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(storagePath))
      return true
    } catch (error: unknown) {
      if (this.errorCode(error) === 'ENOENT') return false
      throw error
    }
  }

  async stat(storagePath: string): Promise<StorageStat | null> {
    try {
      const result = await fs.stat(this.resolvePath(storagePath))
      return {
        size: result.size,
        modifiedAt: result.mtime,
        isDirectory: result.isDirectory(),
      }
    } catch (error: unknown) {
      if (this.errorCode(error) === 'ENOENT') return null
      throw error
    }
  }

  async listEntries(storagePath: string): Promise<StorageEntry[]> {
    const directory = this.resolvePath(storagePath)
    const entries = await fs.readdir(directory, { withFileTypes: true, encoding: 'utf-8' })
      .catch((error: unknown) => {
        if (this.errorCode(error) === 'ENOENT') return null
        throw error
      })
    if (entries === null) return []

    const results = await Promise.all(entries.map(async entry => {
      try {
        const result = await fs.stat(path.join(directory, entry.name))
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: result.size,
          modifiedAt: result.mtime,
        }
      } catch (error: unknown) {
        if (this.errorCode(error) === 'ENOENT') return null
        throw error
      }
    }))
    return results.filter((entry): entry is StorageEntry => entry !== null)
  }

  async readText(storagePath: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolvePath(storagePath), 'utf-8')
    } catch (error: unknown) {
      if (this.errorCode(error) === 'ENOENT') return null
      throw new Error(`CRM storage read failed [${storagePath}]: ${this.errorMessage(error)}`)
    }
  }

  async writeText(storagePath: string, content: string): Promise<void> {
    this.assertWritable()
    await this.serializePath(storagePath, async () => {
      const fullPath = this.resolvePath(storagePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content, 'utf-8')
    })
  }

  async appendText(storagePath: string, content: string): Promise<void> {
    this.assertWritable()
    await this.serializePath(storagePath, async () => {
      const fullPath = this.resolvePath(storagePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.appendFile(fullPath, content, 'utf-8')
    })
  }

  async readMarkdown(storagePath: string): Promise<string | null> {
    const mountedContent = await this.readText(storagePath)
    if (mountedContent !== null || !this.supabase) return mountedContent

    const { data, error } = await this.supabase.storage.from('content').download(storagePath)
    if (error) {
      if (error.message.includes('not found') || error.message.includes('Object not found')) return null
      throw new Error(`Legacy document fallback failed [${storagePath}]: ${error.message}`)
    }
    return data.text()
  }

  async writeMarkdown(storagePath: string, content: string): Promise<void> {
    return this.writeText(storagePath, content)
  }

  async deleteMarkdown(storagePath: string): Promise<void> {
    return this.deleteFile(storagePath)
  }

  async writeFile(storagePath: string, buffer: Buffer): Promise<void> {
    this.assertWritable()
    await this.serializePath(storagePath, async () => {
      const fullPath = this.resolvePath(storagePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, buffer)
    })
  }

  async readFile(storagePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolvePath(storagePath))
    } catch (error: unknown) {
      if (this.errorCode(error) === 'ENOENT') return null
      throw new Error(`CRM storage file read failed [${storagePath}]: ${this.errorMessage(error)}`)
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    this.assertWritable()
    await this.serializePath(storagePath, async () => {
      try {
        await fs.unlink(this.resolvePath(storagePath))
      } catch (error: unknown) {
        if (this.errorCode(error) !== 'ENOENT') {
          this.logger.warn(`CRM storage delete failed [${storagePath}]: ${this.errorMessage(error)}`)
        }
      }
    })
  }

  async uploadVoiceRecording(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, buffer, {
      upsert: true,
      contentType: mimeType,
    })
    if (error) throw new Error(`Voice recording upload failed [${storagePath}]: ${error.message}`)
    return storagePath
  }

  async voiceRecordingSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabaseClient.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds)
    if (error) throw new Error(`Signed URL failed [${storagePath}]: ${error.message}`)
    return data.signedUrl
  }

  async createSignedUploadUrl(storagePath: string): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await this.supabaseClient.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(storagePath)
    if (error) throw new Error(`Signed upload URL failed [${storagePath}]: ${error.message}`)
    return { signedUrl: data.signedUrl, token: data.token }
  }

  async readVoiceRecording(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).download(storagePath)
    if (error) throw new Error(`Voice recording read failed [${storagePath}]: ${error.message}`)
    return Buffer.from(await data.arrayBuffer())
  }

  async deleteVoiceRecording(storagePath: string): Promise<void> {
    const { error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).remove([storagePath])
    if (error) this.logger.warn(`Voice recording delete failed [${storagePath}]: ${error.message}`)
  }

  async uploadProposalSignedPdf(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, buffer, {
      upsert: true,
      contentType: mimeType,
    })
    if (error) throw new Error(`Signed proposal PDF upload failed [${storagePath}]: ${error.message}`)
    return storagePath
  }

  async proposalSignedPdfUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    if (/^https?:\/\//i.test(storagePath)) return storagePath

    const { data, error } = await this.supabaseClient.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds)
    if (error) throw new Error(`Signed proposal PDF URL failed [${storagePath}]: ${error.message}`)
    return data.signedUrl
  }

  async uploadCatalogIcon(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { error } = await this.supabaseClient.storage.from(CATALOG_ICONS_BUCKET).upload(storagePath, buffer, {
      upsert: true,
      contentType: mimeType,
      cacheControl: '31536000',
    })
    if (error) throw new Error(`Catalog icon upload failed [${storagePath}]: ${error.message}`)
    const { data } = this.supabaseClient.storage.from(CATALOG_ICONS_BUCKET).getPublicUrl(storagePath)
    return data.publicUrl
  }

  async deleteCatalogIcon(storagePath: string): Promise<void> {
    const { error } = await this.supabaseClient.storage.from(CATALOG_ICONS_BUCKET).remove([storagePath])
    if (error) this.logger.warn(`Catalog icon delete failed [${storagePath}]: ${error.message}`)
  }

  /** @deprecated Use uploadVoiceRecording() for voice, writeFile() for other binaries. */
  async uploadAttachment(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    return this.uploadVoiceRecording(storagePath, buffer, mimeType)
  }

  /** @deprecated Use readVoiceRecording(). */
  async readAttachment(storagePath: string): Promise<Buffer> {
    return this.readVoiceRecording(storagePath)
  }

  /** @deprecated Use voiceRecordingSignedUrl(). */
  async signedUrl(_bucket: string, storagePath: string, expiresInSeconds = 3600): Promise<string> {
    return this.voiceRecordingSignedUrl(storagePath, expiresInSeconds)
  }

  /** @deprecated Use deleteVoiceRecording() for voice, deleteFile() for other binaries. */
  async delete(_bucket: string, storagePath: string): Promise<void> {
    return this.deleteVoiceRecording(storagePath)
  }

  get isConfigured(): boolean {
    return true
  }

  static readonly extractExcerpt = extractExcerpt
  static readonly extractHtmlExcerpt = extractHtmlExcerpt
}
