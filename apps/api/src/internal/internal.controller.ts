import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { InternalService } from './internal.service'
import { InternalGuard } from './internal.guard'
import { CalendarConnectionsService } from '../calendar/calendar-connections.service'
import { DealsService } from '../deals/deals.service'
import { CompaniesService } from '../companies/companies.service'
import { ContactsService } from '../contacts/contacts.service'
import { DocumentsService } from '../documents/documents.service'
import { ActivitiesService } from '../activities/activities.service'

/**
 * InternalController — endpoints called by Cloud Scheduler, GCP infrastructure,
 * and Aria (the AI assistant) for CRM data access.
 *
 * All routes are protected by InternalGuard (X-Internal-Secret header).
 * Never expose these to the public API documentation.
 *
 * ─── Aria Integration Routes ──────────────────────────────────────────────
 *
 * Aria authenticates with the X-Internal-Secret header (same secret used by
 * Cloud Scheduler). The secret is stored in GCP Secret Manager as
 * `symph-crm-internal-secret` and injected as INTERNAL_SECRET in Cloud Run.
 *
 * When INTERNAL_SECRET is set, Aria can immediately query the CRM.
 *
 * Endpoint summary:
 *   GET  /api/internal/ping               Health check
 *   GET  /api/internal/pipeline           Pipeline summary grouped by stage
 *   GET  /api/internal/deals              List deals (search, stage, companyId, limit)
 *   GET  /api/internal/deals/:id          Deal + context.md + recent activities
 *   PATCH /api/internal/deals/:id         Update deal fields
 *   GET  /api/internal/companies          List / search companies
 *   GET  /api/internal/companies/:id      Company + deals + contacts
 *   GET  /api/internal/contacts           List contacts (search, companyId)
 */
@Controller('internal')
@UseGuards(InternalGuard)
export class InternalController {
  constructor(
    private readonly internalService: InternalService,
    private readonly calendarConnections: CalendarConnectionsService,
    private readonly deals: DealsService,
    private readonly companies: CompaniesService,
    private readonly contacts: ContactsService,
    private readonly documents: DocumentsService,
    private readonly activities: ActivitiesService,
  ) {}

  // ─── Infrastructure (Cloud Scheduler) ────────────────────────────────────

  /**
   * POST /api/internal/sweep
   * Flags dormant deals. Cloud Scheduler: daily at 8am PHT (0 0 * * * UTC)
   */
  @Post('sweep')
  @HttpCode(HttpStatus.OK)
  async sweep() {
    const result = await this.internalService.sweepDormantDeals()
    return { ok: true, dormantFlagged: result.dormantFlagged, dealIds: result.dealIds }
  }

  /**
   * POST /api/internal/calendar-sync
   * Incremental sync for all connected users. Cloud Scheduler: every 5 min.
   */
  @Post('calendar-sync')
  @HttpCode(HttpStatus.OK)
  async calendarSync() {
    const result = await this.calendarConnections.syncAll()
    return { ok: true, usersSynced: result.synced, eventsUpserted: result.totalEvents }
  }

  // ─── Aria CRM Access Routes ───────────────────────────────────────────────

  /**
   * GET /api/internal/ping
   * Aria uses this to verify connectivity and confirm the secret is valid.
   */
  @Get('ping')
  ping() {
    return { ok: true, service: 'symph-crm', ts: new Date().toISOString() }
  }

  /**
   * GET /api/internal/pipeline
   * Pipeline summary grouped by stage — high-level view without fetching every deal.
   */
  @Get('pipeline')
  async pipeline() {
    return this.internalService.getPipelineSummary()
  }

  /**
   * GET /api/internal/deals
   * List deals with optional filters.
   * Query params: search, stage, companyId, limit (default 50)
   */
  @Get('deals')
  async listDeals(
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.deals.findAll({
      search,
      stage,
      companyId,
      limit: limit ? parseInt(limit, 10) : 50,
    })
  }

  /**
   * GET /api/internal/deals/:id
   * Full deal + context.md + recent activities + documents list.
   * Primary endpoint Aria uses when discussing a specific deal.
   */
  @Get('deals/:id')
  async getDeal(@Param('id') id: string) {
    const deal = await this.deals.findOne(id)
    if (!deal) throw new NotFoundException(`Deal ${id} not found`)

    const [dealDocs, recentActivities] = await Promise.all([
      this.documents.findByDeal(id),
      this.activities.findByDeal(id, 20),
    ])

    const contextDoc = dealDocs.find((d) => d.type === 'context')
    let contextMarkdown: string | null = null
    if (contextDoc) {
      contextMarkdown = await this.documents.readContent(contextDoc.id).catch(() => null)
    }

    return { deal, contextMarkdown, documents: dealDocs, recentActivities }
  }

  /**
   * PATCH /api/internal/deals/:id
   * Update deal fields. Aria uses this to advance stage, update value, etc.
   * Audit log attributes changes to "aria".
   */
  @Patch('deals/:id')
  async updateDeal(
    @Param('id') id: string,
    @Body() body: { stage?: string; value?: number; title?: string; [key: string]: unknown },
  ) {
    const { stage, ...rest } = body

    if (stage) {
      await this.deals.updateStage(id, stage, 'aria')
    }

    const updatableFields = ['value', 'title', 'notes'] as const
    const otherFields = Object.fromEntries(
      Object.entries(rest).filter(([k]) => (updatableFields as readonly string[]).includes(k)),
    )
    if (Object.keys(otherFields).length > 0) {
      await this.deals.update(id, otherFields as any, 'aria')
    }

    const updated = await this.deals.findOne(id)
    return { ok: true, deal: updated }
  }

  /**
   * GET /api/internal/companies
   * List or fuzzy-search companies (name/domain).
   * Query params: search
   */
  @Get('companies')
  async listCompanies(@Query('search') search?: string) {
    if (search) return this.companies.search(search)
    return this.companies.findAll()
  }

  /**
   * GET /api/internal/companies/:id
   * Company + all associated deals + contacts + documents.
   * Complete account picture for Aria.
   */
  @Get('companies/:id')
  async getCompany(@Param('id') id: string) {
    const company = await this.companies.findOne(id)
    if (!company) throw new NotFoundException(`Company ${id} not found`)

    const [companyDeals, companyContacts, companyDocs] = await Promise.all([
      this.deals.findByCompany(id),
      this.contacts.findByCompany(id),
      this.documents.findByCompany(id),
    ])

    return { company, deals: companyDeals, contacts: companyContacts, documents: companyDocs }
  }

  /**
   * GET /api/internal/contacts
   * List contacts with optional filters.
   * Query params: search, companyId
   */
  @Get('contacts')
  async listContacts(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.contacts.findAll({ search, companyId })
  }
}
