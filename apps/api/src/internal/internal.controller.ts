import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
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
import { UsersService } from '../users/users.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { PipelineService } from '../pipeline/pipeline.service'

/**
 * InternalController — endpoints called by Cloud Scheduler, GCP infrastructure,
 * and Aria (the AI assistant) for full CRM data access.
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
 * ─── Audit Attribution ─────────────────────────────────────────────────
 *
 * All mutating routes accept optional headers for audit attribution:
 *   X-Performed-By      CRM user ID (FK to users.id) — resolves name/image in audit queries
 *   X-Performed-By-Name Display name (stored in audit details JSONB as fallback)
 *
 * When headers are absent, performedBy defaults to undefined and source is 'aria'.
 *
 * Endpoint summary:
 *
 *   Infrastructure:
 *     POST /api/internal/sweep              Dormancy sweep (Cloud Scheduler)
 *     POST /api/internal/calendar-sync      Calendar sync (Cloud Scheduler)
 *
 *   Health:
 *     GET  /api/internal/ping               Health check
 *
 *   Pipeline:
 *     GET  /api/internal/pipeline           Pipeline summary (basic, from InternalService)
 *     GET  /api/internal/pipeline/summary   Pipeline summary with date range (from PipelineService)
 *
 *   Deals:
 *     GET    /api/internal/deals              List deals (search, stage, companyId, limit, from, to)
 *     GET    /api/internal/deals/:id          Deal + context.md + recent activities
 *     POST   /api/internal/deals              Create deal
 *     PATCH  /api/internal/deals/:id          Update deal fields
 *     PATCH  /api/internal/deals/:id/stage    Update deal stage
 *     PATCH  /api/internal/deals/:id/assign   Reassign deal
 *     DELETE /api/internal/deals/:id          Soft-delete deal
 *
 *   Companies:
 *     GET    /api/internal/companies           List / search companies
 *     GET    /api/internal/companies/:id       Company + deals + contacts
 *     POST   /api/internal/companies           Create company
 *     PUT    /api/internal/companies/:id       Update company
 *     DELETE /api/internal/companies/:id       Soft-delete company
 *
 *   Contacts:
 *     GET    /api/internal/contacts            List contacts (search, companyId)
 *     GET    /api/internal/contacts/:id        Single contact
 *     POST   /api/internal/contacts            Create contact
 *     PUT    /api/internal/contacts/:id        Update contact
 *     DELETE /api/internal/contacts/:id        Soft-delete contact
 *
 *   Activities:
 *     GET    /api/internal/activities           List activities (dealId, companyId, limit)
 *     GET    /api/internal/activities/deal/:id  Activities by deal
 *     GET    /api/internal/activities/company/:id  Activities by company
 *     POST   /api/internal/activities           Create activity
 *
 *   Documents:
 *     GET    /api/internal/documents            List documents (dealId, companyId, type)
 *     GET    /api/internal/documents/:id        Document metadata
 *     GET    /api/internal/documents/:id/content  Read markdown content
 *     POST   /api/internal/documents            Create document (metadata + optional content)
 *     PUT    /api/internal/documents/:id        Update document (metadata + optional content)
 *     DELETE /api/internal/documents/:id        Soft-delete document
 *
 *   Users:
 *     GET    /api/internal/users               List all users
 *     GET    /api/internal/users/:id           Single user
 *
 *   Audit Logs:
 *     GET    /api/internal/audit-logs          List audit logs (entityType, entityId, action, performedBy, from, to, limit, offset)
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
    private readonly users: UsersService,
    private readonly auditLogs: AuditLogsService,
    private readonly pipeline: PipelineService,
  ) {}

  /**
   * Resolve performer identity from request headers.
   * - performedBy: CRM user ID (valid FK for audit log LEFT JOIN) or undefined
   * - performerName: display name for JSONB details
   * - source: always 'aria' for internal API calls
   */
  private resolvePerformer(headers: Record<string, string | string[] | undefined>) {
    const performedBy = (headers['x-performed-by'] as string) || undefined
    const performerName = (headers['x-performed-by-name'] as string) || undefined
    return { performedBy, performerName, source: 'aria' as const }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Infrastructure (Cloud Scheduler)
  // ═══════════════════════════════════════════════════════════════════════════

  /** POST /api/internal/sweep — Flag dormant deals (daily 8am PHT) */
  @Post('sweep')
  @HttpCode(HttpStatus.OK)
  async sweep() {
    const result = await this.internalService.sweepDormantDeals()
    return { ok: true, dormantFlagged: result.dormantFlagged, dealIds: result.dealIds }
  }

  /** POST /api/internal/calendar-sync — Incremental sync all users (every 5 min) */
  @Post('calendar-sync')
  @HttpCode(HttpStatus.OK)
  async calendarSync() {
    const result = await this.calendarConnections.syncAll()
    return { ok: true, usersSynced: result.synced, eventsUpserted: result.totalEvents }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Health
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/ping — Verify connectivity */
  @Get('ping')
  ping() {
    return { ok: true, service: 'symph-crm', ts: new Date().toISOString() }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/pipeline — Basic pipeline summary (InternalService) */
  @Get('pipeline')
  async pipelineBasic() {
    return this.internalService.getPipelineSummary()
  }

  /** GET /api/internal/pipeline/summary — Full summary with date range (PipelineService) */
  @Get('pipeline/summary')
  async pipelineSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.pipeline.getSummary({ from, to })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Deals
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/deals — List with optional filters */
  @Get('deals')
  async listDeals(
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.deals.findAll({
      search,
      stage,
      companyId,
      limit: limit ? parseInt(limit, 10) : 50,
      from,
      to,
    })
  }

  /** GET /api/internal/deals/:id — Full deal + context.md + activities + documents */
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

  /** POST /api/internal/deals — Create a new deal */
  @Post('deals')
  async createDeal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: {
      title: string
      companyId?: string
      workspaceId: string
      stage?: string
      value?: number
      assignedTo?: string
      productId?: string
      tierId?: string
      [key: string]: unknown
    },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const deal = await this.deals.create(body as any, performedBy)
    return { ok: true, deal }
  }

  /** PATCH /api/internal/deals/:id — Update deal fields */
  @Patch('deals/:id')
  async updateDeal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: { stage?: string; value?: number; title?: string; assignedTo?: string; [key: string]: unknown },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const { stage, ...rest } = body

    if (stage) {
      await this.deals.updateStage(id, stage, performedBy)
    }

    const updatableFields = ['value', 'title', 'notes', 'assignedTo', 'companyId', 'productId', 'tierId'] as const
    const otherFields = Object.fromEntries(
      Object.entries(rest).filter(([k]) => (updatableFields as readonly string[]).includes(k)),
    )
    if (Object.keys(otherFields).length > 0) {
      await this.deals.update(id, otherFields as any, performedBy)
    }

    const updated = await this.deals.findOne(id)
    return { ok: true, deal: updated }
  }

  /** PATCH /api/internal/deals/:id/stage — Explicit stage transition */
  @Patch('deals/:id/stage')
  async updateDealStage(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: { stage: string },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const deal = await this.deals.findOne(id)
    if (!deal) throw new NotFoundException(`Deal ${id} not found`)
    await this.deals.updateStage(id, body.stage, performedBy)
    const updated = await this.deals.findOne(id)
    return { ok: true, deal: updated }
  }

  /** PATCH /api/internal/deals/:id/assign — Reassign deal to a user */
  @Patch('deals/:id/assign')
  async reassignDeal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: { assignedTo: string },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const deal = await this.deals.findOne(id)
    if (!deal) throw new NotFoundException(`Deal ${id} not found`)
    await this.deals.update(id, { assignedTo: body.assignedTo } as any, performedBy)
    const updated = await this.deals.findOne(id)
    return { ok: true, deal: updated }
  }

  /** DELETE /api/internal/deals/:id — Remove deal */
  @Delete('deals/:id')
  async removeDeal(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const deal = await this.deals.findOne(id)
    if (!deal) throw new NotFoundException(`Deal ${id} not found`)
    await this.deals.remove(id, performedBy)
    return { ok: true, deleted: id }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Companies
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/companies — List or search */
  @Get('companies')
  async listCompanies(@Query('search') search?: string) {
    if (search) return this.companies.search(search)
    return this.companies.findAll()
  }

  /** GET /api/internal/companies/:id — Company + deals + contacts + documents */
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

  /** POST /api/internal/companies — Create a new company */
  @Post('companies')
  async createCompany(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: {
      name: string
      domain?: string
      workspaceId: string
      createdBy?: string
      [key: string]: unknown
    },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const company = await this.companies.create(
      { ...body, createdBy: body.createdBy ?? performedBy } as any,
      performedBy,
    )
    return { ok: true, company }
  }

  /** PUT /api/internal/companies/:id — Update company */
  @Put('companies/:id')
  async updateCompany(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: { name?: string; domain?: string; [key: string]: unknown },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const company = await this.companies.findOne(id)
    if (!company) throw new NotFoundException(`Company ${id} not found`)
    const updated = await this.companies.update(id, body as any, performedBy)
    return { ok: true, company: updated }
  }

  /** DELETE /api/internal/companies/:id — Remove company */
  @Delete('companies/:id')
  async removeCompany(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const company = await this.companies.findOne(id)
    if (!company) throw new NotFoundException(`Company ${id} not found`)
    await this.companies.remove(id, performedBy)
    return { ok: true, deleted: id }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Contacts
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/contacts — List with optional filters */
  @Get('contacts')
  async listContacts(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.contacts.findAll({ search, companyId })
  }

  /** GET /api/internal/contacts/:id — Single contact */
  @Get('contacts/:id')
  async getContact(@Param('id') id: string) {
    const contact = await this.contacts.findOne(id)
    if (!contact) throw new NotFoundException(`Contact ${id} not found`)
    return contact
  }

  /** POST /api/internal/contacts — Create contact */
  @Post('contacts')
  async createContact(
    @Body() body: {
      name: string
      email?: string
      phone?: string
      role?: string
      companyId?: string
      workspaceId: string
      [key: string]: unknown
    },
  ) {
    const contact = await this.contacts.create(body as any)
    return { ok: true, contact }
  }

  /** PUT /api/internal/contacts/:id — Update contact */
  @Put('contacts/:id')
  async updateContact(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; phone?: string; role?: string; companyId?: string; [key: string]: unknown },
  ) {
    const contact = await this.contacts.findOne(id)
    if (!contact) throw new NotFoundException(`Contact ${id} not found`)
    const updated = await this.contacts.update(id, body as any)
    return { ok: true, contact: updated }
  }

  /** DELETE /api/internal/contacts/:id — Remove contact */
  @Delete('contacts/:id')
  async removeContact(@Param('id') id: string) {
    const contact = await this.contacts.findOne(id)
    if (!contact) throw new NotFoundException(`Contact ${id} not found`)
    await this.contacts.remove(id)
    return { ok: true, deleted: id }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Activities
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/activities — List with filters */
  @Get('activities')
  async listActivities(
    @Query('dealId') dealId?: string,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activities.find({
      dealId,
      companyId,
      limit: limit ? parseInt(limit, 10) : 50,
    })
  }

  /** GET /api/internal/activities/deal/:dealId — Activities for a deal */
  @Get('activities/deal/:dealId')
  async activitiesByDeal(
    @Param('dealId') dealId: string,
    @Query('limit') limit?: string,
  ) {
    return this.activities.findByDeal(dealId, limit ? parseInt(limit, 10) : 50)
  }

  /** GET /api/internal/activities/company/:companyId — Activities for a company */
  @Get('activities/company/:companyId')
  async activitiesByCompany(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.activities.findByCompany(companyId, limit ? parseInt(limit, 10) : 50)
  }

  /** POST /api/internal/activities — Log an activity */
  @Post('activities')
  async createActivity(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: {
      dealId?: string
      companyId?: string
      workspaceId: string
      type: string
      title?: string
      description?: string
      performedBy?: string
      metadata?: Record<string, unknown>
      [key: string]: unknown
    },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const activity = await this.activities.create({
      ...body,
      performedBy: body.performedBy ?? performedBy,
    } as any)
    return { ok: true, activity }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Documents
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/documents — List by deal or company */
  @Get('documents')
  async listDocuments(
    @Query('dealId') dealId?: string,
    @Query('companyId') companyId?: string,
    @Query('type') type?: string,
  ) {
    if (dealId) return this.documents.findByDeal(dealId)
    if (companyId) return this.documents.findByCompany(companyId)
    if (type) return this.documents.findByType(type)
    return []
  }

  /** GET /api/internal/documents/:id — Document metadata */
  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    const doc = await this.documents.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)
    return doc
  }

  /** GET /api/internal/documents/:id/content — Read markdown content from Storage */
  @Get('documents/:id/content')
  async getDocumentContent(@Param('id') id: string) {
    const content = await this.documents.readContent(id)
    return { id, content }
  }

  /** POST /api/internal/documents — Create a document (metadata + optional content) */
  @Post('documents')
  async createDocument(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: {
      dealId?: string
      companyId?: string
      contactId?: string
      workspaceId: string
      authorId?: string
      type: string
      title: string
      content?: string
      storagePath?: string
      tags?: string[]
      isPinned?: boolean
      isAiGenerated?: boolean
      [key: string]: unknown
    },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const doc = await this.documents.create(
      { ...body, authorId: body.authorId ?? performedBy } as any,
      performedBy,
    )
    return { ok: true, document: doc }
  }

  /** PUT /api/internal/documents/:id — Update document (metadata + optional content) */
  @Put('documents/:id')
  async updateDocument(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: {
      title?: string
      content?: string
      type?: string
      tags?: string[]
      isPinned?: boolean
      [key: string]: unknown
    },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const doc = await this.documents.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)
    const updated = await this.documents.update(id, body as any, performedBy)
    return { ok: true, document: updated }
  }

  /** DELETE /api/internal/documents/:id — Soft-delete document */
  @Delete('documents/:id')
  async removeDocument(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const doc = await this.documents.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)
    await this.documents.remove(id)
    return { ok: true, deleted: id }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Users
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/users — List all CRM users */
  @Get('users')
  async listUsers() {
    return this.users.findAll()
  }

  /** GET /api/internal/users/:id — Single user */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.users.findOne(id)
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return user
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Audit Logs
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/internal/audit-logs — List with filters */
  @Get('audit-logs')
  async listAuditLogs(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('performedBy') performedBy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditLogs.find({
      entityType,
      entityId,
      action,
      performedBy,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    })
  }
}
