import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUserId } from '../auth/current-user.decorator'
import { RecordingsService } from './recordings.service'

const DEFAULT_WORKSPACE = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  /**
   * POST /api/recordings/upload  (multipart/form-data)
   * Fields: file (audio blob), title (string), duration (number string)
   *
   * Uploads via server-side Supabase SDK, bypasses bucket RLS entirely.
   * This is the primary upload path; the old presign flow is removed.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; duration?: string },
    @CurrentUserId() userId: string,
  ) {
    if (!file) throw new BadRequestException('No audio file provided')
    return this.recordingsService.upload(userId, file, {
      title: body.title || `Recording ${new Date().toLocaleTimeString('en-PH')}`,
      duration: body.duration ? Math.round(Number(body.duration)) : null,
      workspaceId: DEFAULT_WORKSPACE,
    })
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.recordingsService.findAll(userId)
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.recordingsService.remove(id, userId)
  }

  // ─── Circleback integration: upload, status, retry, playback ───────────────

  @Post('circleback-upload')
  @UseInterceptors(FileInterceptor('file'))
  async circlebackUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('dealId') dealId: string | undefined,
    @CurrentUserId() userId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided')
    return this.recordingsService.circlebackUpload(userId, dealId, file)
  }

  @Get('circleback-status')
  async circlebackStatus(@Query('correlationKey') correlationKey: string) {
    if (!correlationKey) throw new BadRequestException('correlationKey required')
    return this.recordingsService.circlebackStatus(correlationKey)
  }

  @Post('circleback-retry')
  async circlebackRetry(@Body('uploadDocId') uploadDocId: string) {
    if (!uploadDocId) throw new BadRequestException('uploadDocId required')
    return this.recordingsService.circlebackRetry(uploadDocId)
  }

  @Get('circleback-play')
  async circlebackPlay(@Query('fileName') fileName: string) {
    if (!fileName) throw new BadRequestException('fileName required')
    return this.recordingsService.circlebackPlayUrl(fileName)
  }
}
