import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { google } from 'googleapis'
import { calendarEvents, userCalendarConnections } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { CalendarCryptoService } from './calendar-crypto.service'
import { ConfigService } from '@nestjs/config'

export type CreateEventDto = {
  title: string
  description?: string
  startAt: string   // ISO 8601
  endAt: string     // ISO 8601
  location?: string
  attendeeEmails?: string[]
  dealId?: string
  eventType?: 'demo' | 'discovery_call' | 'followup' | 'general'
}

export type UpdateEventDto = Partial<CreateEventDto>

@Injectable()
export class CalendarEventsService {
  constructor(
    @Inject(DB) private db: Database,
    private crypto: CalendarCryptoService,
    private config: ConfigService,
  ) {}

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      this.config.get('GOOGLE_CALENDAR_REDIRECT_URI'),
    )
  }

  private async getAuthedClient(userId: string) {
    const [conn] = await this.db
      .select()
      .from(userCalendarConnections)
      .where(eq(userCalendarConnections.userId, userId))

    if (!conn || !conn.isActive) {
      throw new NotFoundException('Google Calendar not connected for this user')
    }

    const oauth2 = this.getOAuth2Client()
    oauth2.setCredentials({ refresh_token: this.crypto.decrypt(conn.refreshToken) })
    return google.calendar({ version: 'v3', auth: oauth2 })
  }

  async findAll(userId: string, params: { from?: string; to?: string; dealId?: string } = {}) {
    const conditions = [eq(calendarEvents.userId, userId)]
    if (params.from) {
      const fromDate = new Date(params.from)
      conditions.push(gte(calendarEvents.startAt, fromDate))
    }
    if (params.to) {
      const toDate = new Date(params.to)
      conditions.push(lte(calendarEvents.startAt, toDate))
    }
    if (params.dealId) conditions.push(eq(calendarEvents.dealId, params.dealId))

    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(desc(calendarEvents.startAt))

    // Derive isOwner from Google's rawJson.organizer.self field.
    // Events created through the CRM always have organizer.self = true.
    // Future Google Calendar sync may import events where the user is only an attendee.
    return rows.map((row) => ({
      ...row,
      isOwner: (row.rawJson as Record<string, any> | null)?.organizer?.self !== false,
    }))
  }

  async findOne(id: string) {
    const [event] = await this.db.select().from(calendarEvents).where(eq(calendarEvents.id, id))
    return event ?? null
  }

  /**
   * Create event in Google Calendar + mirror locally.
   */
  async create(userId: string, dto: CreateEventDto) {
    const calApi = await this.getAuthedClient(userId)

    const googleEvent = await calApi.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: dto.title,
        description: dto.description,
        location: dto.location,
        start: { dateTime: dto.startAt },
        end: { dateTime: dto.endAt },
        attendees: (dto.attendeeEmails ?? []).map((email) => ({ email })),
      },
    })

    const [row] = await this.db
      .insert(calendarEvents)
      .values({
        googleEventId: googleEvent.data.id!,
        userId,
        title: dto.title,
        description: dto.description ?? null,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        location: dto.location ?? null,
        attendeeEmails: dto.attendeeEmails ?? [],
        dealId: dto.dealId ?? null,
        eventType: dto.eventType ?? 'general',
        rawJson: googleEvent.data,
      })
      .returning()

    return row
  }

  /**
   * Update event in Google Calendar + update local mirror.
   */
  async update(id: string, userId: string, dto: UpdateEventDto) {
    const existing = await this.findOne(id)
    if (!existing) throw new NotFoundException(`Calendar event ${id} not found`)

    const calApi = await this.getAuthedClient(userId)

    const patchBody: Record<string, any> = {}
    if (dto.title) patchBody['summary'] = dto.title
    if (dto.description !== undefined) patchBody['description'] = dto.description
    if (dto.location !== undefined) patchBody['location'] = dto.location
    if (dto.startAt) patchBody['start'] = { dateTime: dto.startAt }
    if (dto.endAt) patchBody['end'] = { dateTime: dto.endAt }
    if (dto.attendeeEmails) patchBody['attendees'] = dto.attendeeEmails.map((email) => ({ email }))

    await calApi.events.patch({
      calendarId: 'primary',
      eventId: existing.googleEventId,
      requestBody: patchBody,
    })

    const [updated] = await this.db
      .update(calendarEvents)
      .set({
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.startAt && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt && { endAt: new Date(dto.endAt) }),
        ...(dto.attendeeEmails && { attendeeEmails: dto.attendeeEmails }),
        ...(dto.dealId !== undefined && { dealId: dto.dealId }),
        ...(dto.eventType && { eventType: dto.eventType }),
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, id))
      .returning()

    return updated
  }

  /**
   * Delete event from Google Calendar + remove local mirror.
   */
  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.findOne(id)
    if (!existing) throw new NotFoundException(`Calendar event ${id} not found`)

    const calApi = await this.getAuthedClient(userId)
    await calApi.events.delete({
      calendarId: 'primary',
      eventId: existing.googleEventId,
    })

    await this.db.delete(calendarEvents).where(eq(calendarEvents.id, id))
  }

  /**
   * Link an existing event to a deal (no Google mutation needed).
   */
  async linkToDeal(id: string, dealId: string) {
    const [updated] = await this.db
      .update(calendarEvents)
      .set({ dealId, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning()
    return updated
  }
}
