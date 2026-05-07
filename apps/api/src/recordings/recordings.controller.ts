import { Controller, Get, Post, Delete, Param, Body, Headers } from '@nestjs/common'
import { RecordingsService, CreateRecordingDto } from './recordings.service'

@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('presign')
  presign(
    @Body() body: { filename: string; mimeType: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.recordingsService.presign(userId, body.filename, body.mimeType)
  }

  @Post()
  create(
    @Body() body: CreateRecordingDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.recordingsService.create(userId, body)
  }

  @Get()
  findAll(@Headers('x-user-id') userId: string) {
    return this.recordingsService.findAll(userId)
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.recordingsService.remove(id, userId)
  }
}
