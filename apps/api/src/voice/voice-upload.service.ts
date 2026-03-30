import { Injectable, Inject, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { files, deals } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { StorageService, ATTACHMENTS_BUCKET } from '../storage/storage.service'
import { VoiceService } from './voice.service'

/** Extension derived from MIME type for storage path construction. */
const MIME_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/x-m4a': 'm4a',
}

export type AudioPersistMeta = {
  /** The user uploading the file — stored as uploadedBy. */
  userId: string
  /** If the note belongs to a deal, links the file record. */
  dealId?: string
}

export type TranscribeResult = {
  text: string
  /** The persisted file ID — present when storage is configured. */
  fileId?: string
}

export type TranscribeError = Error & {
  /** fileId is set when audio was persisted but Groq failed. FE can offer retry. */
  fileId?: string
  retryable: boolean
}

@Injectable()
export class VoiceUploadService {
  private readonly logger = new Logger(VoiceUploadService.name)

  constructor(
    @Inject(DB) private db: Database,
    private storage: StorageService,
    private voice: VoiceService,
  ) {}

  /**
   * Full lifecycle: persist audio → attempt transcription → update DB record.
   *
   * If Supabase Storage is not configured, falls back to transcription-only
   * (no retry possible — degraded mode, logged as warning).
   *
   * On transcription failure the error is enriched with `fileId` and `retryable: true`
   * so the caller can surface a "retry" button to the user.
   */
  async persistAndTranscribe(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    meta: AudioPersistMeta,
  ): Promise<TranscribeResult> {
    // ── Degrade gracefully if Storage is not yet wired up ──────────────────
    if (!this.storage.isConfigured) {
      this.logger.warn(
        'Supabase Storage not configured — transcribing without persistence. ' +
        'Retry will not be available if this fails.',
      )
      const text = await this.voice.transcribe(buffer, mimeType, filename)
      return { text }
    }

    // ── 1. Resolve companyId from deal (for storage path) ─────────────────
    let companyId: string | null = null
    if (meta.dealId) {
      const [deal] = await this.db.select({ companyId: deals.companyId }).from(deals).where(eq(deals.id, meta.dealId))
      companyId = deal?.companyId ?? null
    }

    // ── 2. Persist audio to Supabase Storage ──────────────────────────────
    // Path: brand/{companyId}/{dealId}/audio/{ts}-{name}.{ext}
    // Falls back to brand/unassigned/{userId}/audio/... when no company/deal.
    const ext = MIME_TO_EXT[mimeType.split(';')[0].trim()] ?? 'webm'
    const brandSegment = companyId ?? 'unassigned'
    const dealSegment  = meta.dealId ?? meta.userId
    const storagePath = `brand/${brandSegment}/${dealSegment}/audio/${Date.now()}-${sanitizeFilename(filename)}.${ext}`

    await this.storage.uploadAttachment(storagePath, buffer, mimeType)
    this.logger.log(`Audio persisted: ${storagePath} (${buffer.length} bytes)`)

    // ── 3. Create DB record (transcription_status = 'pending') ─────────────
    const [fileRow] = await this.db
      .insert(files)
      .values({
        uploadedBy: meta.userId,
        companyId: companyId ?? undefined,
        dealId: meta.dealId ?? null,
        filename,
        storagePath,
        fileUrl: storagePath,   // signed URL generated on demand — not stored
        fileSize: buffer.length,
        mimeType,
        transcriptionStatus: 'pending',
      })
      .returning()

    // ── 4. Attempt Groq transcription ─────────────────────────────────────
    try {
      const text = await this.voice.transcribe(buffer, mimeType, filename)

      await this.db
        .update(files)
        .set({ transcriptionStatus: 'success', transcriptionText: text })
        .where(eq(files.id, fileRow.id))

      return { text, fileId: fileRow.id }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Transcription failed for file ${fileRow.id}: ${message}`)

      await this.db
        .update(files)
        .set({ transcriptionStatus: 'failed', transcriptionError: message })
        .where(eq(files.id, fileRow.id))

      // Re-throw with fileId attached so the controller can return it to the FE
      const enriched = new Error(`Transcription failed: ${message}`) as TranscribeError
      enriched.fileId = fileRow.id
      enriched.retryable = true
      throw enriched
    }
  }

  /**
   * Re-transcribe a previously stored audio file.
   * Fetches the binary from Supabase Storage and calls Groq again.
   * Increments retryCount. Returns the transcription text on success.
   *
   * Throws if:
   *  - File not found in DB
   *  - Storage not configured
   *  - Transcription fails again (error includes updated retryCount)
   */
  async retryTranscription(fileId: string): Promise<TranscribeResult> {
    const [fileRow] = await this.db.select().from(files).where(eq(files.id, fileId))
    if (!fileRow) throw new NotFoundException(`File ${fileId} not found`)

    if (!this.storage.isConfigured) {
      throw new ServiceUnavailableException(
        'Supabase Storage is not configured — cannot fetch stored audio for retry.',
      )
    }

    // Increment retryCount immediately so it's accurate even if we throw
    await this.db
      .update(files)
      .set({
        transcriptionStatus: 'pending',
        transcriptionError: null,
        retryCount: sql`${files.retryCount} + 1`,
      })
      .where(eq(files.id, fileId))

    const buffer = await this.storage.readAttachment(fileRow.storagePath)

    try {
      const text = await this.voice.transcribe(buffer, fileRow.mimeType ?? 'audio/webm', fileRow.filename)

      await this.db
        .update(files)
        .set({ transcriptionStatus: 'success', transcriptionText: text })
        .where(eq(files.id, fileId))

      this.logger.log(`Retry transcription success for file ${fileId}`)
      return { text, fileId }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Retry transcription failed for file ${fileId}: ${message}`)

      await this.db
        .update(files)
        .set({ transcriptionStatus: 'failed', transcriptionError: message })
        .where(eq(files.id, fileId))

      const enriched = new Error(`Retry transcription failed: ${message}`) as TranscribeError
      enriched.fileId = fileId
      enriched.retryable = true
      throw enriched
    }
  }

  /** Return the signed URL for an audio file (1-hour expiry). */
  async getAudioUrl(fileId: string): Promise<string> {
    const [fileRow] = await this.db.select().from(files).where(eq(files.id, fileId))
    if (!fileRow) throw new NotFoundException(`File ${fileId} not found`)
    return this.storage.signedUrl(ATTACHMENTS_BUCKET, fileRow.storagePath)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip characters that are problematic in storage paths. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')           // strip extension (we add it explicitly)
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // replace special chars
    .slice(0, 40)                       // cap length
}
