import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CalendarConnectionsService } from './calendar-connections.service'
import { CalendarEventsService, CreateEventDto, UpdateEventDto } from './calendar-events.service'

/**
 * CalendarController — Google Calendar integration endpoints.
 *
 * Auth: uses req.headers['x-user-id'] for user identity.
 * TODO: replace with real JWT middleware once auth is wired.
 */
@Controller()
export class CalendarController {
  constructor(
    private connections: CalendarConnectionsService,
    private events: CalendarEventsService,
  ) {}

  // ─── OAuth Flow ──────────────────────────────────────────────────────────

  /**
   * GET /api/auth/google-calendar/connect
   * Redirects AM to Google OAuth consent screen.
   */
  @Get('auth/google-calendar/connect')
  connect(@Res() res: Response) {
    const url = this.connections.getAuthUrl()
    res.redirect(url)
  }

  /**
   * GET /api/auth/google-calendar/callback
   * Google redirects here after consent. Exchanges code, runs initial sync.
   */
  @Get('auth/google-calendar/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Extract userId from session/header (temporary: pass via state param)
    const userId = state || (req.headers['x-user-id'] as string)
    if (!userId || !code) {
      return res.status(400).json({ error: 'Missing code or userId' })
    }

    await this.connections.handleCallback(userId, code)

    // Redirect back to the calendar page in the web app
    const webUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000'
    res.redirect(`${webUrl}/calendar?connected=true`)
  }

  /**
   * GET /api/auth/google-calendar/status
   * Returns connection status for the current user.
   */
  @Get('auth/google-calendar/status')
  async status(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string
    const conn = await this.connections.getConnection(userId)
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
