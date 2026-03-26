import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { InternalService } from './internal.service'
import { InternalGuard } from './internal.guard'
import { CalendarConnectionsService } from '../calendar/calendar-connections.service'

/**
 * InternalController — endpoints called by Cloud Scheduler / GCP infrastructure.
 * All routes are protected by InternalGuard (X-Internal-Secret header).
 * Never expose these to the public API documentation.
 */
@Controller('internal')
@UseGuards(InternalGuard)
export class InternalController {
  constructor(
    private readonly internalService: InternalService,
    private readonly calendarConnections: CalendarConnectionsService,
  ) {}

  /**
   * POST /api/internal/sweep
   *
   * Flags all deals that have exceeded their workspace dormancy threshold.
   * Called by Cloud Scheduler daily at 8am PHT (0 0 * * * UTC → 8am PHT).
   *
   * Cloud Scheduler config:
   *   Schedule:    0 0 * * *
   *   Target URL:  https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api/internal/sweep
   *   HTTP method: POST
   *   Headers:     X-Internal-Secret: <from Secret Manager>
   *   Auth:        None (header-based for MVP; upgrade to OIDC for prod)
   */
  @Post('sweep')
  @HttpCode(HttpStatus.OK)
  async sweep() {
    const result = await this.internalService.sweepDormantDeals()
    return {
      ok: true,
      dormantFlagged: result.dormantFlagged,
      dealIds: result.dealIds,
    }
  }

  /**
   * POST /api/internal/calendar-sync
   *
   * Incremental sync for all connected users using stored syncTokens.
   * Called by Cloud Scheduler every 5 minutes.
   *
   * Cloud Scheduler config:
   *   Schedule:    *\/5 * * * *
   *   Target URL:  https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api/internal/calendar-sync
   *   HTTP method: POST
   *   Headers:     X-Internal-Secret: <from Secret Manager>
   */
  @Post('calendar-sync')
  @HttpCode(HttpStatus.OK)
  async calendarSync() {
    const result = await this.calendarConnections.syncAll()
    return {
      ok: true,
      usersSynced: result.synced,
      eventsUpserted: result.totalEvents,
    }
  }
}
