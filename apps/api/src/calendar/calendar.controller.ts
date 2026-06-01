import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, Res, HttpCode, HttpStatus, Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CalendarConnectionsService } from './calendar-connections.service'
import { CalendarEventsService, CreateEventDto, UpdateEventDto } from './calendar-events.service'

/**
 * CalendarController — Google Calendar integration endpoints.
 *
 * Auth: normal CRM routes receive x-user-id from the trusted Next.js API bridge.
 * The OAuth callback is public but verifies its signed state before writing tokens.
 */
@Controller()
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name)

  constructor(
    private connections: CalendarConnectionsService,
    private events: CalendarEventsService,
  ) {}

  // ─── OAuth Flow ──────────────────────────────────────────────────────────

  /**
   * GET /api/auth/google-calendar/connect
   * Redirects AM to Google OAuth consent screen.
   * The trusted bridge injects x-user-id, which is signed into OAuth state so the
   * callback can identify the user after the browser redirect through Google.
   */
  @Get('auth/google-calendar/connect')
  connect(
    @Query('returnTo') returnTo: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = req.headers['x-user-id'] as string | undefined
    if (!userId) {
      return res.status(400).json({ error: 'Missing trusted CRM session user' })
    }
    const url = this.connections.getAuthUrl(userId, returnTo || '/calendar')
    res.redirect(url)
  }

  /**
   * GET /api/auth/google-calendar/callback
   * Google redirects here after consent. The userId is in the `state` param.
   * Always redirects back to the web app — never leaves the user on a raw API URL.
   */
  @Get('auth/google-calendar/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ) {
    const webUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000'

    let userId = ''
    let returnTo = '/calendar'

    if (state) {
      try {
        const decoded = this.connections.decodeState(state)
        userId = decoded.userId
        returnTo = decoded.returnTo
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid OAuth state'
        return res.redirect(`${webUrl}/calendar?oauth_error=${encodeURIComponent(message)}`)
      }
    }

    const errorRedirect = (msg: string) =>
      res.redirect(`${webUrl}${returnTo}?oauth_error=${encodeURIComponent(msg)}`)

    // Google itself returned an error (e.g. user denied consent)
    if (oauthError) return errorRedirect(oauthError)

    // Missing required params
    if (!state || !code) return errorRedirect('Missing code or state')

    try {
      await this.connections.handleCallback(userId, code)
      res.redirect(`${webUrl}${returnTo}?connected=true`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`OAuth callback failed for user ${userId}: ${message}`)
      errorRedirect(message)
    }
  }

  /**
   * GET /api/auth/google-calendar/status
   * Returns connection status for the current user.
   */
  @Get('auth/google-calendar/status')
  async status(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      this.logger.warn('[calendar/status] Missing x-user-id header')
      return { connected: false }
    }
    const conn = await this.connections.getConnection(userId)
    this.logger.debug(`[calendar/status] userId=${userId}, found=${!!conn}`)
    return conn
      ? { connected: true, googleEmail: conn.googleEmail, lastSyncedAt: conn.lastSyncedAt }
      : { connected: false }
  }

  /**
   * DELETE /api/auth/google-calendar/disconnect
   * Disconnects the AM's Google Calendar.
   */
  @Delete('auth/google-calendar/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string
    await this.connections.disconnect(userId)
    return { ok: true }
  }

  // ─── Calendar Events ─────────────────────────────────────────────────────

  /**
   * GET /api/calendar/team-demos
   * Returns all demo events across the entire team.
   * No userId restriction — open to all authenticated users.
   * ?from=2026-03-01&to=2026-03-31
   */
  @Get('calendar/team-demos')
  findTeamDemos(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.events.findTeamDemos({ from, to })
  }

  /**
   * GET /api/calendar/events
   * Returns events for the current user.
   * ?from=2026-03-01&to=2026-03-31&dealId=<uuid>
   */
  @Get('calendar/events')
  findAll(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dealId') dealId?: string,
  ) {
    const userId = req.headers['x-user-id'] as string
    return this.events.findAll(userId, { from, to, dealId })
  }

  /**
   * GET /api/calendar/events/:id
   */
  @Get('calendar/events/:id')
  findOne(@Param('id') id: string) {
    return this.events.findOne(id)
  }

  /**
   * POST /api/calendar/events
   * Creates event in Google Calendar + mirrors locally.
   */
  @Post('calendar/events')
  create(@Req() req: Request, @Body() dto: CreateEventDto) {
    const userId = req.headers['x-user-id'] as string
    return this.events.create(userId, dto)
  }

  /**
   * PATCH /api/calendar/events/:id
   * Updates event in Google Calendar + local mirror.
   */
  @Patch('calendar/events/:id')
  update(@Param('id') id: string, @Req() req: Request, @Body() dto: UpdateEventDto) {
    const userId = req.headers['x-user-id'] as string
    return this.events.update(id, userId, dto)
  }

  /**
   * PATCH /api/calendar/events/:id/deal
   * Links event to a deal (local-only, no Google mutation).
   */
  @Patch('calendar/events/:id/deal')
  linkToDeal(@Param('id') id: string, @Body() body: { dealId: string }) {
    return this.events.linkToDeal(id, body.dealId)
  }

  /**
   * DELETE /api/calendar/events/:id
   * Deletes from Google Calendar + removes local mirror.
   */
  @Delete('calendar/events/:id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.headers['x-user-id'] as string
    return this.events.remove(id, userId)
  }
}
