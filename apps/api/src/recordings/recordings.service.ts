import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common'
import { eq, desc, and } from 'drizzle-orm'
import { recordings } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class RecordingsService {
  constructor(
    @Inject(DB) private db: Database,
    private storage: StorageService,
  ) {}

  /**
   * Upload a recording: server receives the audio blob as multipart/form-data,
   * uploads to Supabase via the service-role key (bypasses bucket RLS), then
   * saves the metadata row to the DB.
   */
  async upload(
    userId: string,
    file: Express.Multer.File,
    dto: { title: string; duration: number | null; workspaceId: string },
  ) {
    if (!userId) throw new ForbiddenException('Missing user id')

    const ext = file.mimetype.includes('mp4') ? 'm4a'
      : file.mimetype.includes('ogg') ? 'ogg'
      : 'webm'
    const storageKey = `recordings/${userId}/${Date.now()}.${ext}`

    await this.storage.uploadVoiceRecording(storageKey, file.buffer, file.mimetype)

    const [row] = await this.db
      .insert(recordings)
      .values({
        userId,
        workspaceId: dto.workspaceId,
        title: dto.title,
        duration: dto.duration,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })
      .returning()

    const playbackUrl = await this.storage.voiceRecordingSignedUrl(storageKey).catch(() => '')
    return { ...row, playbackUrl }
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

  // ─── Circleback integration: proxy to meetings.symph.co ─────────────────────

  private getMeetingsConfig(): { url: string; secret: string } {
    const url = process.env.MEETINGS_APP_URL ?? 'https://meetings.symph.co'
    const secret = process.env.MEETINGS_CRM_SECRET
    if (!secret) throw new Error('MEETINGS_CRM_SECRET not configured')
    return { url, secret }
  }

  async circlebackUpload(
    _userId: string,
    dealId: string | undefined,
    file: Express.Multer.File,
  ): Promise<{ ok: boolean; correlationKey: string; uploadDocId: string; dealId?: string }> {
    const { url: meetingsUrl, secret } = this.getMeetingsConfig()

    const formData = new FormData()
    const bufferView = new Uint8Array(file.buffer)
    const blob = new Blob([bufferView], { type: file.mimetype })
    formData.append('file', blob, file.originalname)
    formData.append('fileName', file.originalname)
    if (dealId) formData.append('dealId', dealId)

    const res = await fetch(`${meetingsUrl}/api/crm/upload`, {
      method: 'POST',
      headers: { 'X-CRM-Secret': secret },
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload to meetings.symph.co failed: ${await res.text()}`)
    const data = await res.json()
    return { ...data, dealId }
  }

  async circlebackStatus(correlationKey: string): Promise<{
    status: string
    crmPushStatus?: string
    circleback_meeting_id?: string
    uploadDocId?: string
  }> {
    const { url: meetingsUrl, secret } = this.getMeetingsConfig()

    const res = await fetch(
      `${meetingsUrl}/api/crm/status?correlationKey=${encodeURIComponent(correlationKey)}`,
      { headers: { 'X-CRM-Secret': secret } },
    )
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
    return res.json()
  }

  async circlebackRetry(uploadDocId: string): Promise<{ ok: boolean; status: string }> {
    const { url: meetingsUrl, secret } = this.getMeetingsConfig()

    const res = await fetch(`${meetingsUrl}/api/crm/retry`, {
      method: 'POST',
      headers: { 'X-CRM-Secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadDocId }),
    })
    if (!res.ok) throw new Error(`Retry failed: ${await res.text()}`)
    return res.json()
  }

  async circlebackPlayUrl(fileName: string): Promise<{ playbackUrl: string }> {
    const { url: meetingsUrl, secret } = this.getMeetingsConfig()

    const res = await fetch(
      `${meetingsUrl}/api/crm/recordings/play?fileName=${encodeURIComponent(fileName)}`,
      { headers: { 'X-CRM-Secret': secret } },
    )
    if (!res.ok) throw new Error(`Playback URL fetch failed: ${res.status}`)
    return res.json()
  }
}
