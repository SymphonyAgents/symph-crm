import { Controller, Get, Query } from '@nestjs/common'
import { AuditLogsService } from './audit-logs.service'

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  /**
   * GET /api/audit-logs
   * ?entityType=deal|company|contact|...
   * ?entityId=<uuid>
   * ?action=create|update|delete|status_change
   * ?performedBy=<userId>
   * ?from=<ISO date>
   * ?to=<ISO date>
   * ?limit=<number>  (max 200, default 50)
   * ?offset=<number> (default 0)
   */
  @Get()
  find(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('performedBy') performedBy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditLogsService.find({
      entityType,
      entityId,
      action,
      performedBy,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    })
  }
}
