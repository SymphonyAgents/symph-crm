import { Controller, Get, Post, Delete, Param, Headers, Body, Req, HttpCode, HttpException, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'
import { GmailService, SendEmailDto } from './gmail.service'

/**
 * GmailController — Gmail inbox + send + archive/trash endpoints.
 *
 * GET    /api/gmail/inbox                  — fetch this month's filtered threads
 * GET    /api/gmail/user                   — get connected Google account email
 * POST   /api/gmail/send                   — send an email (new message or reply)
 * POST   /api/gmail/threads/:id/archive    — archive a thread (remove INBOX label)
 * DELETE /api/gmail/threads/:id            — trash a thread
 */
@Controller()
export class GmailController {
  constructor(private gmail: GmailService) {}

  /**
   * GET /api/gmail/inbox
   * Returns threads for the requesting user (filtered, CC-only, this month).
   */
  @Get('gmail/inbox')
  async inbox(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string
    return this.gmail.getInbox(userId)
  }

  /**
   * GET /api/gmail/user
   * Returns { email } for the connected Google account.
   * Frontend uses this to know which side of the chat to render messages on.
   */
  @Get('gmail/user')
  async getUser(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string
    const result = await this.gmail.getGoogleEmail(userId)
    if (!result) return { email: null, needsReconnect: true }
    return result
  }

  /**
   * POST /api/gmail/send
   * Send an email on behalf of the requesting user.
   * Body: { to, cc?, subject, body, threadId?, inReplyTo? }
   */
  @Post('gmail/send')
  async send(@Req() req: Request, @Body() body: SendEmailDto) {
    const userId = req.headers['x-user-id'] as string
    try {
      return await this.gmail.sendEmail(userId, body)
    } catch (err: any) {
      throw new HttpException(
        err.message ?? 'Failed to send email',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  // POST /api/gmail/threads/:id/read — mark all messages in thread as read
  @Post('gmail/threads/:id/read')
  @HttpCode(200)
  async markRead(@Param('id') threadId: string, @Headers('x-user-id') userId?: string) {
    try {
      await this.gmail.markThreadRead(userId ?? '', threadId)
      return { ok: true }
    } catch (err: any) {
      throw new HttpException(err.message ?? 'Failed to mark thread as read', HttpStatus.BAD_REQUEST)
    }
  }

  // POST /api/gmail/threads/:id/archive — archive a thread (remove INBOX label)
  @Post('gmail/threads/:id/archive')
  @HttpCode(200)
  async archive(@Req() req: Request, @Param('id') threadId: string) {
    const userId = req.headers['x-user-id'] as string
    try {
      await this.gmail.archiveThread(userId, threadId)
      return { success: true }
    } catch (err: any) {
      throw new HttpException(err.message ?? 'Failed to archive thread', HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * DELETE /api/gmail/threads/:id
   * Trash a thread — moves to Gmail Trash.
   */
  @Delete('gmail/threads/:id')
  @HttpCode(200)
  async trash(@Req() req: Request, @Param('id') threadId: string) {
    const userId = req.headers['x-user-id'] as string
    try {
      await this.gmail.trashThread(userId, threadId)
      return { success: true }
    } catch (err: any) {
      throw new HttpException(err.message ?? 'Failed to trash thread', HttpStatus.BAD_REQUEST)
    }
  }
}
