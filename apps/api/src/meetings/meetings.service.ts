import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { companies, contacts, deals, meetings } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { DealNotesService } from '../deals/deal-notes.service'
import { DealsService } from '../deals/deals.service'
import { normalizeDealTitleForSearch } from '../deals/deal-title-normalization.util'

type MeetingStatus = 'pending' | 'done' | 'failed'

export type PassiveMeetingIngestBody = {
  workspaceId: string
  dealId?: string | null
  sourceMeetingId: string
  sourceUrl: string
  title: string
  startedAt?: string | null
  endedAt?: string | null
  attendees?: string[]
  summaryMarkdown?: string | null
  transcriptMarkdown?: string | null
  rawPayload?: Record<string, unknown>
}

type MeetingUpdate = Partial<typeof meetings.$inferInsert>

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`Invalid date: ${value}`)
  return parsed
}

function safeSourceId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'meeting'
}

function meetingNoteDate(startedAt: Date | null): Date {
  return startedAt ?? new Date()
}

@Injectable()
export class MeetingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly dealNotes: DealNotesService,
    private readonly dealsService: DealsService,
  ) {}

  async findAll(params?: { workspaceId?: string; status?: MeetingStatus; dealId?: string; limit?: number }) {
    const limit = params?.limit ?? 50
    const conditions = []

    if (params?.workspaceId) conditions.push(eq(meetings.workspaceId, params.workspaceId))
    if (params?.status) conditions.push(eq(meetings.status, params.status))
    if (params?.dealId) conditions.push(eq(meetings.dealId, params.dealId))

    const base = this.db.select().from(meetings)
    return conditions.length > 0
      ? base.where(and(...conditions)).orderBy(desc(meetings.createdAt)).limit(limit)
      : base.orderBy(desc(meetings.createdAt)).limit(limit)
  }

  async findOne(id: string) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, id)).limit(1)
    if (!meeting) throw new NotFoundException(`Meeting ${id} not found`)
    return meeting
  }

  async findOneWithArtifacts(id: string) {
    const meeting = await this.findOne(id)
    const [summaryNote, transcriptNote] = await Promise.all([
      meeting.summaryNotePath ? this.dealNotes.readNoteByStoragePath(meeting.summaryNotePath).catch(() => null) : null,
      meeting.transcriptNotePath ? this.dealNotes.readNoteByStoragePath(meeting.transcriptNotePath).catch(() => null) : null,
    ])

    return { meeting, summaryNote, transcriptNote }
  }

  async findBySourceMeetingId(sourceMeetingId: string) {
    const [meeting] = await this.db
      .select()
      .from(meetings)
      .where(eq(meetings.sourceMeetingId, sourceMeetingId))
      .limit(1)
    if (!meeting) throw new NotFoundException(`Meeting ${sourceMeetingId} not found`)
    return meeting
  }

  async ingest(body: PassiveMeetingIngestBody) {
    this.validateIngestBody(body)

    const startedAt = parseOptionalDate(body.startedAt)
    const endedAt = parseOptionalDate(body.endedAt)
    const rawPayload: Record<string, unknown> = { ...body }

    const [meeting] = await this.db
      .insert(meetings)
      .values({
        workspaceId: body.workspaceId,
        dealId: body.dealId ?? null,
        sourceMeetingId: body.sourceMeetingId,
        sourceUrl: body.sourceUrl,
        title: body.title,
        startedAt,
        endedAt,
        attendees: body.attendees ?? [],
        status: 'pending',
        lastError: null,
        rawPayload,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: meetings.sourceMeetingId,
        set: {
          workspaceId: body.workspaceId,
          dealId: body.dealId ?? null,
          sourceUrl: body.sourceUrl,
          title: body.title,
          startedAt,
          endedAt,
          attendees: body.attendees ?? [],
          status: 'pending',
          lastError: null,
          rawPayload,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!body.dealId) return { ok: true, meeting, status: 'pending' as const }

    try {
      const deal = await this.dealsService.findOne(body.dealId)
      if (!deal) throw new NotFoundException(`Deal ${body.dealId} not found`)

      if (!body.summaryMarkdown || !body.transcriptMarkdown) {
        const updated = await this.updateMeeting(meeting.id, {
          status: 'pending',
          lastError: 'Summary and transcript markdown are required before marking meeting done.',
        })
        return { ok: true, meeting: updated, status: 'pending' as const }
      }

      const noteDate = meetingNoteDate(startedAt)
      const sourceId = safeSourceId(body.sourceMeetingId)
      const metadata = {
        source: 'meetings.symph.co',
        sourceMeetingId: body.sourceMeetingId,
        sourceUrl: body.sourceUrl,
        meetingId: meeting.id,
      }
      const authorId = deal.assignedTo ?? null

      const [summaryNote, transcriptNote] = await Promise.all([
        this.dealNotes.upsertNote(
          body.dealId,
          'meeting',
          `Meeting Summary - ${body.title}`,
          body.summaryMarkdown,
          authorId,
          {
            filename: `circleback-${sourceId}-summary.md`,
            createdAt: noteDate,
            metadata: { ...metadata, artifactType: 'summary' },
          },
        ),
        this.dealNotes.upsertNote(
          body.dealId,
          'transcript_raw',
          `Transcript - ${body.title}`,
          body.transcriptMarkdown,
          authorId,
          {
            filename: `circleback-${sourceId}-transcript.md`,
            createdAt: noteDate,
            metadata: { ...metadata, artifactType: 'transcript' },
          },
        ),
      ])

      const updated = await this.updateMeeting(meeting.id, {
        status: 'done',
        lastError: null,
        summaryNotePath: summaryNote.storagePath,
        transcriptNotePath: transcriptNote.storagePath,
        ingestedAt: new Date(),
      })

      return { ok: true, meeting: updated, summaryNote, transcriptNote, status: 'done' as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Meeting ingest failed'
      const failed = await this.updateMeeting(meeting.id, { status: 'failed', lastError: message })
      if (error instanceof NotFoundException) throw error
      return { ok: false, meeting: failed, status: 'failed' as const, error: message }
    }
  }

  async retryIngest(id: string) {
    const meeting = await this.findOne(id)
    const rawPayload = meeting.rawPayload

    if (!rawPayload) {
      const failed = await this.updateMeeting(id, {
        status: 'failed',
        lastError: 'No saved payload is available for retry.',
        retryCount: meeting.retryCount + 1,
      })
      return { ok: false, meeting: failed, status: 'failed' as const, error: failed.lastError }
    }

    await this.updateMeeting(id, { retryCount: meeting.retryCount + 1 })
    return this.ingest(rawPayload as PassiveMeetingIngestBody)
  }

  async assignDeal(id: string, dealId: string) {
    const meeting = await this.findOne(id)
    const deal = await this.dealsService.findOne(dealId)
    if (!deal) throw new NotFoundException(`Deal ${dealId} not found`)

    const rawPayload = {
      ...(meeting.rawPayload ?? {}),
      workspaceId: meeting.workspaceId,
      sourceMeetingId: meeting.sourceMeetingId,
      sourceUrl: meeting.sourceUrl,
      title: meeting.title,
      startedAt: meeting.startedAt?.toISOString() ?? null,
      endedAt: meeting.endedAt?.toISOString() ?? null,
      attendees: meeting.attendees,
      dealId,
    } as PassiveMeetingIngestBody

    const [updated] = await this.db
      .update(meetings)
      .set({ dealId, rawPayload, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning()

    return { ok: true, meeting: updated }
  }

  async findResolverCandidates(terms: string, limit = 10) {
    const normalized = normalizeDealTitleForSearch(terms)
    const searchTerms = normalized.split(' ').filter(term => term && term !== 'and')
    const dealsByTitle = searchTerms.length > 0
      ? await this.dealsService.findAll({ search: terms, limit })
      : []

    const companyRows = normalized
      ? await this.db
          .select({ company: companies })
          .from(companies)
          .where(ilike(companies.name, `%${normalized}%`))
          .limit(limit)
      : []

    const contactRows = normalized
      ? await this.db
          .select({ contact: contacts })
          .from(contacts)
          .where(sql`lower(${contacts.name}) LIKE ${`%${normalized}%`} OR lower(${contacts.email}) LIKE ${`%${normalized}%`}`)
          .limit(limit)
      : []

    const companyIds = companyRows.map(row => row.company.id)
    const dealsByCompany = companyIds.length > 0
      ? await this.db.select().from(deals).where(inArray(deals.companyId, companyIds as [string, ...string[]])).limit(limit)
      : []

    return {
      deals: dealsByTitle,
      companies: companyRows.map(row => row.company),
      contacts: contactRows.map(row => row.contact),
      dealsByCompany,
    }
  }

  private validateIngestBody(body: PassiveMeetingIngestBody): void {
    if (!body.workspaceId) throw new BadRequestException('workspaceId is required')
    if (!body.sourceMeetingId) throw new BadRequestException('sourceMeetingId is required')
    if (!body.sourceUrl) throw new BadRequestException('sourceUrl is required')
    if (!body.title) throw new BadRequestException('title is required')
  }

  private async updateMeeting(id: string, update: MeetingUpdate) {
    const [meeting] = await this.db
      .update(meetings)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning()
    return meeting
  }
}
