import * as fs from 'fs/promises'
import * as path from 'path'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const ATTACHMENTS_BUCKET = 'attachments'
export const CATALOG_ICONS_BUCKET = 'catalog-icons'

/**
 * StorageService — NFS-primary document storage.
 *
 * ALL document files (markdown notes, images, PDFs, PPTX, docs) are stored on
 * the shared NFS volume at `{NFS_MOUNT_PATH}/crm/{storagePath}`.
 *
 * In production:  NFS_MOUNT_PATH=/share  →  /share/crm/deals/{id}/notes/...
 * In local dev:   NFS_MOUNT_PATH=~/Documents/symph-crm-vault  (or any local dir)
 *
 * Voice recordings are the ONLY exception — they stay in Supabase Storage
 * (ATTACHMENTS_BUCKET) because they need signed URLs for in-browser playback.
 *
 * Migration note: readMarkdown() falls back to Supabase Storage `content` bucket
 * for documents written before the NFS migration. This fallback should be removed
 * once the one-time migration script has been run.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private supabase: SupabaseClient | null = null

  /** Root path for all CRM files on the NFS volume. */
  private readonly nfsRoot: string

  constructor(private config: ConfigService) {
    const mountPath = config.get<string>('NFS_MOUNT_PATH')
    if (!mountPath) {
      throw new Error(
        'NFS_MOUNT_PATH is required but not set.\n' +
        '  Production:  NFS_MOUNT_PATH=/share\n' +
        '  Local dev:   NFS_MOUNT_PATH=/path/to/your/local-vault (e.g. ~/Documents/symph-crm-vault)',
      )
    }
    this.nfsRoot = path.join(mountPath, 'crm')

    // Supabase — for voice recordings only
    const url = config.get<string>('SUPABASE_URL')
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) {
      this.supabase = createClient(url, key, { auth: { persistSession: false } })
      this.logger.log('Supabase Storage initialized (voice recordings only)')
    } else {
      this.logger.warn('SUPABASE_SERVICE_ROLE_KEY not configured — voice recording storage disabled')
    }
  }

  async onModuleInit() {
    // Ensure NFS root is accessible and create if needed
    try {
      await fs.mkdir(this.nfsRoot, { recursive: true })
      await fs.access(this.nfsRoot, fs.constants.R_OK | fs.constants.W_OK)
      this.logger.log(`NFS storage ready at ${this.nfsRoot}`)
    } catch (err: any) {
      throw new Error(
        `NFS storage at ${this.nfsRoot} is not accessible: ${err.message}\n` +
        'Check that NFS_MOUNT_PATH is mounted and writable.',
      )
    }
  }

  private get supabaseClient(): SupabaseClient {
    if (!this.supabase) throw new Error('Supabase Storage not configured (voice recording storage disabled)')
    return this.supabase
  }

  /** Resolve a storage path to its absolute NFS location. */
  private nfsPath(storagePath: string): string {
    return path.join(this.nfsRoot, storagePath)
  }

  // ── Markdown content ──────────────────────────────────────────────────────

  /**
   * Read a markdown file from NFS.
   * Falls back to Supabase Storage `content` bucket for pre-migration documents.
   * Remove the fallback once the one-time migration script has been run.
   */
  async readMarkdown(storagePath: string): Promise<string | null> {
    // Primary: NFS
    try {
      return await fs.readFile(this.nfsPath(storagePath), 'utf-8')
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw new Error(`NFS read failed [${storagePath}]: ${err.message}`)
      }
    }

    // Migration fallback: document exists in Supabase Storage but not on NFS yet
    if (!this.supabase) return null
    const { data, error } = await this.supabase.storage.from('content').download(storagePath)
    if (error) {
      if (error.message.includes('not found') || error.message.includes('Object not found')) return null
      throw new Error(`Supabase migration fallback failed [${storagePath}]: ${error.message}`)
    }
    return await data.text()
  }

  /** Write (upsert) a markdown file to NFS. Creates intermediate dirs as needed. */
  async writeMarkdown(storagePath: string, content: string): Promise<void> {
    const fullPath = this.nfsPath(storagePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
  }

  /** Delete a markdown file from NFS. No-op if not found. */
  async deleteMarkdown(storagePath: string): Promise<void> {
    try {
      await fs.unlink(this.nfsPath(storagePath))
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        this.logger.warn(`NFS delete failed [${storagePath}]: ${err.message}`)
      }
    }
  }

  // ── Binary files (images, PDFs, PPTX, docs) ──────────────────────────────

  /** Write a binary file to NFS. */
  async writeFile(storagePath: string, buffer: Buffer): Promise<void> {
    const fullPath = this.nfsPath(storagePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
  }

  /** Read a binary file from NFS. Returns null if not found. */
  async readFile(storagePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.nfsPath(storagePath))
    } catch (err: any) {
      if (err.code === 'ENOENT') return null
      throw new Error(`NFS file read failed [${storagePath}]: ${err.message}`)
    }
  }

  /** Delete a binary file from NFS. No-op if not found. */
  async deleteFile(storagePath: string): Promise<void> {
    try {
      await fs.unlink(this.nfsPath(storagePath))
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        this.logger.warn(`NFS file delete failed [${storagePath}]: ${err.message}`)
      }
    }
  }

  // ── Voice recordings (Supabase Storage) ──────────────────────────────────

  /** Upload a voice recording. Returns the storage path. */
  async uploadVoiceRecording(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, buffer, {
      upsert: true,
      contentType: mimeType,
    })
    if (error) throw new Error(`Voice recording upload failed [${storagePath}]: ${error.message}`)
    return storagePath
  }

  /** Generate a signed URL for a voice recording (expires in 1 hour by default). */
  async voiceRecordingSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabaseClient.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds)
    if (error) throw new Error(`Signed URL failed [${storagePath}]: ${error.message}`)
    return data.signedUrl
  }

  /**
   * Create a signed upload URL for direct browser-to-Supabase uploads.
   * Returns both the signed URL and the upload token. The browser PUTs the file
   * bytes directly to signedUrl, bypassing the API server.
   */
  async createSignedUploadUrl(storagePath: string): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await this.supabaseClient.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(storagePath)
    if (error) throw new Error(`Signed upload URL failed [${storagePath}]: ${error.message}`)
    return { signedUrl: data.signedUrl, token: data.token }
  }

  /** Read a voice recording from Supabase Storage as a buffer. */
  async readVoiceRecording(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).download(storagePath)
    if (error) throw new Error(`Voice recording read failed [${storagePath}]: ${error.message}`)
    return Buffer.from(await data.arrayBuffer())
  }

  /** Delete a voice recording from Supabase Storage. */
  async deleteVoiceRecording(storagePath: string): Promise<void> {
    const { error } = await this.supabaseClient.storage.from(ATTACHMENTS_BUCKET).remove([storagePath])
    if (error) this.logger.warn(`Voice recording delete failed [${storagePath}]: ${error.message}`)
  }

  // ── Catalog icons (Supabase Storage, public bucket) ──────────────────────
  //
  // Catalog icons (product / service / reseller logos) are public assets so
  // we use a dedicated public bucket and return the public URL — no signing
  // needed, no expiry. Bucket must be created with `public = true` in the
  // Supabase dashboard or via SQL.

  /** Upload a catalog icon and return its public URL. */
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

  /** Delete a catalog icon. Best-effort. */
  async deleteCatalogIcon(storagePath: string): Promise<void> {
    const { error } = await this.supabaseClient.storage.from(CATALOG_ICONS_BUCKET).remove([storagePath])
    if (error) this.logger.warn(`Catalog icon delete failed [${storagePath}]: ${error.message}`)
  }

  // ── Legacy compat (kept for existing callers during transition) ───────────

  /** @deprecated Use uploadVoiceRecording() for voice, writeFile() for other binaries */
  async uploadAttachment(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    return this.uploadVoiceRecording(storagePath, buffer, mimeType)
  }

  /** @deprecated Use readVoiceRecording() */
  async readAttachment(storagePath: string): Promise<Buffer> {
    return this.readVoiceRecording(storagePath)
  }

  /** @deprecated Use voiceRecordingSignedUrl() */
  async signedUrl(bucket: string, storagePath: string, expiresInSeconds = 3600): Promise<string> {
    return this.voiceRecordingSignedUrl(storagePath, expiresInSeconds)
  }

  /** @deprecated Use deleteVoiceRecording() for voice, deleteFile() for other binaries */
  async delete(bucket: string, storagePath: string): Promise<void> {
    return this.deleteVoiceRecording(storagePath)
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  get isConfigured(): boolean {
    return true // NFS is always configured — errors at startup if not
  }

  /** Extract a ~500-char excerpt and word count from markdown content. */
  static extractExcerpt(content: string): { excerpt: string; wordCount: number } {
    const stripped = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\n{2,}/g, ' ')
      .trim()
    const excerpt = stripped.slice(0, 500)
    const wordCount = content.split(/\s+/).filter(Boolean).length
    return { excerpt, wordCount }
  }
}
