import { Module } from '@nestjs/common'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { FileParserModule } from '../file-parser/file-parser.module'

@Module({
  imports: [AuditLogsModule, FileParserModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
