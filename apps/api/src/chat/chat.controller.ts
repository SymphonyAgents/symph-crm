import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ChatService, ChatMessageDto, AttachmentContext } from './chat.service'
import { FileParserService } from '../file-parser/file-parser.service'
import { VoiceService } from '../voice/voice.service'
import { VoiceUploadService, TranscribeError } from '../voice/voice-upload.service'
import { CurrentUserId } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { CrmUserRole } from '@symph-crm/shared'

// Chat is accessible to all authenticated CRM users regardless of role.
// Without this, the global RolesGuard defaults mutations to SALES-only,
// blocking BUILD users from creating sessions or sending messages.
@Roles(CrmUserRole.Sales, CrmUserRole.Build)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly fileParser: FileParserService,
    private readonly voice: VoiceService,
    private readonly voiceUpload: VoiceUploadService,
  ) {}


  /**
   * POST /api/chat/parse-file
   * Accepts a base64-encoded file and returns its extracted text.
   * Used by the Next.js Aria route to inject file content into the prompt.
   */
  @Post('parse-file')
  async parseFile(@Body() body: { base64: string; mimeType: string; filename: string }) {
    const buffer = Buffer.from(body.base64, 'base64')
    if (!this.fileParser.canParse(body.mimeType)) {
      return { text: `[Unsupported file type: ${body.mimeType}]` }
    }
    const result = await this.fileParser.parse(buffer, body.mimeType, body.filename)
    return { text: result.text }
  }

  /**
   * POST /api/chat/message
   * Text-only JSON endpoint — existing flow unchanged.
   */
  @Post('message')
  sendMessage(@CurrentUserId() userId: string, @Body() dto: ChatMessageDto) {
    return this.chatService.sendMessage({ ...dto, userId })
  }

  /**
   * POST /api/chat/upload
   * Multipart endpoint for file / image / voice attachments.
   * Form fields mirror ChatMessageDto. The file field is "attachment".
   *
   * Voice flow (new):
   *  1. Audio is uploaded to Supabase Storage and a `files` record created.
   *  2. Groq transcription is attempted.
   *  3a. Success → chat is sent with the transcript as context.
   *  3b. Failure → 422 returned with { error, fileId, retryable: true }.
   *      FE shows "Retry transcription" — user calls POST /api/voice/retry/:fileId,
   *      gets text back, then completes the send via POST /api/chat/message.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB hard cap
    }),
  )
  async uploadAndChat(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ChatMessageDto,
  ) {
    const trustedBody = { ...body, userId }
    let attachmentContext: AttachmentContext | undefined

    if (file) {
      const { mimetype, originalname, buffer } = file
      const baseMime = mimetype.split(';')[0].trim()

      if (this.voice.canTranscribe(mimetype)) {
        // ── Voice ──────────────────────────────────────────────────────────
        if (!this.voice.isConfigured) {
          throw new BadRequestException(
            'Voice transcription is not yet configured on this server. Add GROQ_API_KEY.',
          )
        }

        try {
          const { text, fileId } = await this.voiceUpload.persistAndTranscribe(
            buffer,
            mimetype,
            originalname,
            {
              userId: trustedBody.userId,
              dealId: trustedBody.dealId ?? undefined,
            },
          )
          attachmentContext = { type: 'voice', filename: originalname, text, fileId }
        } catch (err: unknown) {
          const te = err as TranscribeError
          if (te.retryable) {
            // Audio is persisted — tell FE it can retry without re-recording
            throw new UnprocessableEntityException({
              error: 'TranscriptionFailed',
              message: te.message,
              fileId: te.fileId,
              retryable: true,
            })
          }
          throw err
        }
      } else if (baseMime.startsWith('image/')) {
        // ── Image ─────────────────────────────────────────────────────────
        const supportedMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        const mediaType = supportedMediaTypes.includes(baseMime)
          ? (baseMime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
          : 'image/jpeg'

        attachmentContext = {
          type: 'image',
          filename: originalname,
          imageData: {
            base64: buffer.toString('base64'),
            mediaType,
          },
        }
      } else if (this.fileParser.canParse(mimetype)) {
        // ── Document ──────────────────────────────────────────────────────
        const parsed = await this.fileParser.parse(buffer, mimetype, originalname)
        attachmentContext = {
          type: 'file',
          filename: originalname,
          text: parsed.text,
        }
      } else {
        throw new BadRequestException(`Unsupported file type: ${mimetype}`)
      }
    }

    return this.chatService.sendMessage({ ...trustedBody, attachmentContext })
  }

  /**
   * GET /api/chat/sessions?userId=xxx
   * List all chat sessions for a user, most recent first.
   */
  @Get('sessions')
  listSessions(@CurrentUserId() userId: string) {
    return this.chatService.listSessions(userId)
  }

  /**
   * POST /api/chat/sessions
   * Create a new chat session.
   */
  @Post('sessions')
  createSession(@CurrentUserId() userId: string, @Body() body: { workspaceId: string; dealId?: string; title?: string }) {
    return this.chatService.createSession({ ...body, userId })
  }

  /**
   * GET /api/chat/sessions/:sessionId/history
   */
  @Get('sessions/:sessionId/history')
  getHistory(@Param('sessionId') sessionId: string) {
    return this.chatService.getHistory(sessionId)
  }

  /**
   * POST /api/chat/sessions/:sessionId/messages/user
   * Persist the user's message immediately on send, before AI responds.
   * Returns the saved message ID so the client can replace its optimistic placeholder.
   */
  @Post('sessions/:sessionId/messages/user')
  saveUserMessage(
    @Param('sessionId') sessionId: string,
    @CurrentUserId() userId: string,
    @Body() body: { userMessage: string },
  ) {
    return this.chatService.saveUserMessage(sessionId, userId, body.userMessage)
  }

  /**
   * POST /api/chat/sessions/:sessionId/messages/assistant
   * Persist the assistant's reply once the stream is complete.
   */
  @Post('sessions/:sessionId/messages/assistant')
  saveAssistantMessage(
    @Param('sessionId') sessionId: string,
    @CurrentUserId() userId: string,
    @Body() body: { assistantMessage: string },
  ) {
    return this.chatService.saveAssistantMessage(sessionId, userId, body.assistantMessage)
  }

  /**
   * POST /api/chat/sessions/:sessionId/messages
   * Save a user+assistant message pair after a completed Aria stream.
   * Kept for backwards compatibility.
   */
  @Post('sessions/:sessionId/messages')
  saveMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUserId() userId: string,
    @Body() body: { userMessage: string; assistantMessage: string },
  ) {
    return this.chatService.saveMessages(sessionId, userId, body.userMessage, body.assistantMessage)
  }

  @Delete('sessions/:sessionId')
  deleteSession(@Param('sessionId') sessionId: string) {
    return this.chatService.deleteSession(sessionId)
  }
}
