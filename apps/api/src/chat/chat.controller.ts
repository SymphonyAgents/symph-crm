import {
  Controller,
  Post,
  Get,
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

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly fileParser: FileParserService,
    private readonly voice: VoiceService,
    private readonly voiceUpload: VoiceUploadService,
  ) {}

  /**
   * POST /api/chat/message
   * Text-only JSON endpoint — existing flow unchanged.
   */
  @Post('message')
  sendMessage(@Body() dto: ChatMessageDto) {
    return this.chatService.sendMessage(dto)
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
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ChatMessageDto,
  ) {
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
              userId: body.userId,
              dealId: body.dealId ?? undefined,
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

    return this.chatService.sendMessage({ ...body, attachmentContext })
  }

  /**
   * GET /api/chat/sessions?userId=xxx
   * List all chat sessions for a user, most recent first.
   */
  @Get('sessions')
  listSessions(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId query param is required')
    return this.chatService.listSessions(userId)
  }

  /**
   * POST /api/chat/sessions
   * Create a new chat session.
   */
  @Post('sessions')
  createSession(@Body() body: { userId: string; workspaceId: string; dealId?: string; title?: string }) {
    return this.chatService.createSession(body)
  }

  /**
   * GET /api/chat/sessions/:sessionId/history
   */
  @Get('sessions/:sessionId/history')
  getHistory(@Param('sessionId') sessionId: string) {
    return this.chatService.getHistory(sessionId)
  }
}
