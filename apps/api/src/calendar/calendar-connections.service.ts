import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { google, type calendar_v3, type Auth } from 'googleapis'
import { userCalendarConnections, calendarEvents } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { CalendarCryptoService } from './calendar-crypto.service'
import { ConfigService } from '@nestjs/config'

const SYNC_WINDOW_DAYS = 30

@Injectable()
export class CalendarConnectionsService {
  private readonly logger = new Logger(CalendarConnectionsService.name)

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

  /**
   * Step 1 — generate the OAuth2 consent URL.
   * State encodes both userId and returnTo as "userId|returnTo" so the callback
   * can identify the user AND redirect back to the correct page (Inbox or Calendar).
   * Google echoes the state param back verbatim — headers are lost in the redirect.
   */
  getAuthUrl(userId: string, returnTo = '/calendar'): string {
    const oauth2 = this.getOAuth2Client()
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force refresh_token on every connect
      state: `${userId}|${returnTo}`,  // decoded in handleCallback
      scope: [
        'openid',
        'email',   // required: userinfo.get() needs email scope to return the address
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
      ],
    })
  }

  /**
   * Decode the OAuth state param: "userId|returnTo" → { userId, returnTo }.
   * Backwards-compatible: if no pipe, treats entire string as userId.
   */
  decodeState(state: string): { userId: string; returnTo: string } {
    const pipeIdx = state.indexOf('|')
    if (pipeIdx === -1) return { userId: state, returnTo: '/calendar' }
    return {
      userId: state.slice(0, pipeIdx),
      returnTo: state.slice(pipeIdx + 1) || '/calendar',
    }
  }

  /**
   * Step 2 — exchange auth code → tokens, run initial sync, persist connection.
   * Called from the OAuth callback endpoint.
   */
  async handleCallback(userId: string, code: string): Promise<void> {
    const oauth2 = this.getOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
      throw new Error('No refresh_token returned — user may need to re-consent')
    }

    // Get the Google account email
    oauth2.setCredentials(tokens)
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: profile } = await oauth2Api.userinfo.get()

    const encryptedToken = this.crypto.encrypt(tokens.refresh_token)

    // Upsert connection (AM may reconnect)
    await this.db
      .insert(userCalendarConnections)
      .values({
        userId,
        googleEmail: profile.email!,
        refreshToken: encryptedToken,
        isActive: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userCalendarConnections.userId,
        set: {
          googleEmail: profile.email!,
          refreshToken: encryptedToken,
          syncToken: null, // reset sync — full resync on reconnect
          isActive: true,
          updatedAt: new Date(),
        },
      })

    // Run initial 30-day sync immediately
    await this.syncUser(userId)
    this.logger.log(`Calendar connected for user ${userId} (${profile.email})`)
  }

  /**
   * Incremental sync for a single user using stored syncToken.
   * Falls back to full 30-day sync if syncToken is missing or invalid.
   */
  async syncUser(userId: string): Promise<number> {
    const [conn] = await this.db
      .select()
      .from(userCalendarConnections)
      .where(eq(userCalendarConnections.userId, userId))

    if (!conn || !conn.isActive) return 0

    const oauth2 = this.getOAuth2Client()
    oauth2.setCredentials({
      refresh_token: this.crypto.decrypt(conn.refreshToken),
    })
    const calendar = google.calendar({ version: 'v3', auth: oauth2 })

    let pageToken: string | undefined
    let syncToken: string | undefined
    let upsertCount = 0

    try {
      // Incremental sync if we have a syncToken
      // Full sync window: start of current month → now + 30 days (so past events this month are included)
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const listParams: calendar_v3.Params$Resource$Events$List = {
        calendarId: 'primary',
        ...(conn.syncToken
          ? { syncToken: conn.syncToken }
          : {
              singleEvents: true,
              timeMin: monthStart.toISOString(),
              timeMax: new Date(Date.now() + SYNC_WINDOW_DAYS * 86400000).toISOString(),
              maxResults: 250,
            }),
      }

      do {
        if (pageToken) listParams.pageToken = pageToken
        const response = await calendar.events.list(listParams)
        const { items = [], nextPageToken, nextSyncToken } = response.data

        for (const event of items) {
          if (event.status === 'cancelled') {
            // Remove cancelled events
            if (event.id) {
              await this.db
                .delete(calendarEvents)
                .where(eq(calendarEvents.googleEventId, event.id))
            }
          } else {
            await this.upsertEvent(userId, event)
            upsertCount++
          }
        }

        pageToken = nextPageToken ?? undefined
        if (nextSyncToken) syncToken = nextSyncToken
      } while (pageToken)

      // Persist updated syncToken
      await this.db
        .update(userCalendarConnections)
        .set({ syncToken, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(userCalendarConnections.userId, userId))

      return upsertCount
    } catch (err: any) {
      // 410 Gone = syncToken expired, retry full sync
      if (err?.code === 410 || err?.status === 410) {
        this.logger.warn(`syncToken expired for user ${userId}, running full sync`)
        await this.db
          .update(userCalendarConnections)
          .set({ syncToken: null })
          .where(eq(userCalendarConnections.userId, userId))
        return this.syncUser(userId)
      }
      throw err
    }
  }

  /**
   * Sync all active connections. Called by POST /api/internal/calendar-sync.
   */
  async syncAll(): Promise<{ synced: number; totalEvents: number }> {
    const connections = await this.db
      .select()
      .from(userCalendarConnections)
      .where(eq(userCalendarConnections.isActive, true))

    let totalEvents = 0
    for (const conn of connections) {
      try {
        const count = await this.syncUser(conn.userId)
        totalEvents += count
      } catch (err) {
        this.logger.error(`Sync failed for user ${conn.userId}`, err)
      }
    }

    return { synced: connections.length, totalEvents }
  }

  /**
   * Disconnect a user's calendar — marks inactive, clears tokens.
   */
  async disconnect(userId: string): Promise<void> {
    await this.db
      .update(userCalendarConnections)
      .set({ isActive: false, syncToken: null, updatedAt: new Date() })
      .where(eq(userCalendarConnections.userId, userId))
  }

  async getConnection(userId: string) {
    const [conn] = await this.db
      .select({
        id: userCalendarConnections.id,
        userId: userCalendarConnections.userId,
        googleEmail: userCalendarConnections.googleEmail,
        isActive: userCalendarConnections.isActive,
        lastSyncedAt: userCalendarConnections.lastSyncedAt,
      })
      .from(userCalendarConnections)
      .where(eq(userCalendarConnections.userId, userId))
    return conn ?? null
  }

  /**
   * Returns an authenticated OAuth2 client for the given user.
   * Used by other services (e.g. GmailService) that share the same token store.
   * Returns null if the user has no active connection.
   */
  async getAuthedOAuth2Client(userId: string): Promise<Auth.OAuth2Client | null> {
    if (!userId) return null

    const [conn] = await this.db
      .select()
      .from(userCalendarConnections)
      .where(eq(userCalendarConnections.userId, userId))

    if (!conn || !conn.isActive) return null

    const oauth2 = this.getOAuth2Client()
    oauth2.setCredentials({ refresh_token: this.crypto.decrypt(conn.refreshToken) })
    return oauth2
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async upsertEvent(userId: string, event: any): Promise<void> {
    if (!event.start?.dateTime && !event.start?.date) return

    const startAt = new Date(event.start.dateTime ?? event.start.date)
    const endAt = new Date(event.end.dateTime ?? event.end.date)
    const attendeeEmails = (event.attendees ?? []).map((a: any) => a.email).filter(Boolean)

    await this.db
      .insert(calendarEvents)
      .values({
        googleEventId: event.id,
        userId,
        title: event.summary ?? '(No title)',
        description: event.description ?? null,
        startAt,
        endAt,
        location: event.location ?? null,
        attendeeEmails,
        rawJson: event,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [calendarEvents.googleEventId, calendarEvents.userId],
        set: {
          title: event.summary ?? '(No title)',
          description: event.description ?? null,
          startAt,
          endAt,
          location: event.location ?? null,
          attendeeEmails,
          rawJson: event,
          updatedAt: new Date(),
        },
      })
  }
}
