import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { eq, desc, and } from 'drizzle-orm'
import { recordings } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { StorageService } from '../storage/storage.service'

export type CreateRecordingDto = {
  title: string
  duration: number | null
  storageKey: string
  mimeType: string
  sizeBytes: number | null
  workspaceId: string
}

@Injectable()
export class RecordingsService {
  constructor(
    @Inject(DB) private db: Database,
    private storage: StorageService,
  ) {}

  /**
   * Generate a signed upload URL the browser can PUT directly to.
   * The storage path is namespaced by user to avoid collisions and to give
   * us a clean ownership boundary.
   */
  async presign(userId: string, filename: string, mimeType: string) {
    if (!userId) throw new ForbiddenException('Missing user id')
    if (!filename) throw new BadRequestException('filename is required')
    if (!mimeType) throw new BadRequestException('mimeType is required')

    const safeName = filename.replace(/[^\w.\-]+/g, '_')
    const storageKey = `recordings/${userId}/${Date.now()}-${safeName}`
    const { signedUrl, token } = await this.storage.createSignedUploadUrl(storageKey)
    return { uploadUrl: signedUrl, token, storageKey }
  }

  /** Insert a recording row after the browser has uploaded the audio bytes. */
  async create(userId: string, dto: CreateRecordingDto) {
    if (!userId) throw new ForbiddenException('Missing user id')
    if (!dto.title) throw new BadRequestException('title is required')
    if (!dto.storageKey) throw new BadRequestException('storageKey is required')
    if (!dto.mimeType) throw new BadRequestException('mimeType is required')
    if (!dto.workspaceId) throw new BadRequestException('workspaceId is required')

    const [row] = await this.db
      .insert(recordings)
      .values({
        userId,
        workspaceId: dto.workspaceId,
        title: dto.title,
        duration: dto.duration ?? null,
        storageKey: dto.storageKey,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes ?? null,
      })
      .returning()
    return row
  }

  /**
   * List recordings for a user, newest first, with a fresh signed playback URL
   * for each row (1 hour TTL). Limited to 100 to keep response shape predictable.
   */
  async findAll(userId: string) {
    if (!userId) throw new ForbiddenException('Missing user id')

    const rows: (typeof recordings.$inferSelect)[] = await this.db
      .select()
      .from(recordings)
      .where(eq(recordings.userId, userId))
      .orderBy(desc(recordings.createdAt))
      .limit(100)

    const enriched = await Promise.all(
      rows.map(async (r: typeof recordings.$inferSelect) => {
        let playbackUrl = ''
        try {
          playbackUrl = await this.storage.voiceRecordingSignedUrl(r.storageKey)
        } catch {
          // If the underlying object is missing (manually deleted from Supabase),
          // surface an empty URL so the UI can still render the row.
          playbackUrl = ''
        }
        return { ...r, playbackUrl }
      }),
    )
    return enriched
  }

  /** Verify ownership, then delete from Supabase Storage and the DB. */
  async remove(id: string, userId: string) {
    if (!userId) throw new ForbiddenException('Missing user id')

    const [row] = await this.db
      .select()
      .from(recordings)
      .where(and(eq(recordings.id, id), eq(recordings.userId, userId)))
      .limit(1)

    if (!row) throw new NotFoundException('Recording not found')

    await this.storage.deleteVoiceRecording(row.storageKey)
    await this.db.delete(recordings).where(eq(recordings.id, id))
    return { ok: true }
  }
}
