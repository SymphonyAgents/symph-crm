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
import { ConfigService } from '@nestjs/config'
import { OwnerGuard } from './owner.guard'
import { DealsService } from '../deals/deals.service'
import { DealNotesService } from '../deals/deal-notes.service'
import { CompaniesService } from '../companies/companies.service'
import { ContactsService } from '../contacts/contacts.service'
import { DocumentsService } from '../documents/documents.service'
import { ActivitiesService } from '../activities/activities.service'
import { UsersService } from '../users/users.service'
import { PipelineService } from '../pipeline/pipeline.service'
import { WikiService } from '../wiki/wiki.service'
import { ChatService } from '../chat/chat.service'

/**
 * OwnerController — full CRM access for the product owner via static API key.
 *
 * Designed for use from Claude Code / terminal without requiring Google OAuth.
 * Protected by OwnerGuard (x-api-key header, OWNER_API_KEY env var).
 *
 * ─── Auth ──────────────────────────────────────────────────────────────────
 *   Header: x-api-key: <OWNER_API_KEY>
 *   Secret: GCP Secret Manager → symph-crm-owner-api-key → injected as OWNER_API_KEY
 *
 * ─── Audit Attribution ─────────────────────────────────────────────────────
 *   Optional headers on mutating routes:
 *     X-Performed-By      CRM user ID (FK → users.id) — defaults to 'owner'
 *     X-Performed-By-Name Display name (stored in audit JSONB as fallback)
 *
 * ─── Endpoint Summary ──────────────────────────────────────────────────────
 *
 *   Health:
 *     GET  /api/owner/ping
 *
 *   Pipeline:
 *     GET  /api/owner/pipeline
 *     GET  /api/owner/pipeline/summary
 *
 *   Deals:
 *     GET    /api/owner/deals
 *     GET    /api/owner/deals/:id
 *     POST   /api/owner/deals
 *     PATCH  /api/owner/deals/:id
 *     PATCH  /api/owner/deals/:id/stage
 *     PATCH  /api/owner/deals/:id/assign
 *     DELETE /api/owner/deals/:id
 *
 *   Deal Notes:
 *     GET    /api/owner/deals/:id/notes
 *     POST   /api/owner/deals/:id/notes
 *     GET    /api/owner/deals/:id/summaries
 *     GET    /api/owner/deals/:id/summaries/:filename
 *     POST   /api/owner/deals/:id/summaries
 *
 *   Companies:
 *     GET    /api/owner/companies
 *     GET    /api/owner/companies/:id
 *     POST   /api/owner/companies
 *     PUT    /api/owner/companies/:id
 *     DELETE /api/owner/companies/:id
 *
 *   Contacts:
 *     GET    /api/owner/contacts
 *     GET    /api/owner/contacts/:id
 *     POST   /api/owner/contacts
 *     PUT    /api/owner/contacts/:id
 *     DELETE /api/owner/contacts/:id
 *
 *   Activities:
 *     GET    /api/owner/activities
 *     GET    /api/owner/activities/deal/:dealId
 *     GET    /api/owner/activities/company/:companyId
 *     POST   /api/owner/activities
 *
 *   Documents:
 *     GET    /api/owner/documents
 *     GET    /api/owner/documents/:id
 *     GET    /api/owner/documents/:id/content
 *     POST   /api/owner/documents
 *     PUT    /api/owner/documents/:id
 *     DELETE /api/owner/documents/:id
 *
 *   Users (read-only):
 *     GET    /api/owner/users
 *     GET    /api/owner/users/:id
 *     GET    /api/owner/users/by-discord/:discordId
 *
 *   Wiki:
 *     GET    /api/owner/wiki/index
 *     GET    /api/owner/wiki/page
 *     POST   /api/owner/wiki/page
 *     POST   /api/owner/wiki/log
 *
 *   Chat:
 *     GET    /api/owner/chats?userId=...
 *     GET    /api/owner/chats/:sessionId/messages
 *     POST   /api/owner/chats/message
 */
@Controller('owner')
@UseGuards(OwnerGuard)
export class OwnerController {
  private readonly baseUrl: string

  constructor(
    private readonly config: ConfigService,
    private readonly deals: DealsService,
    private readonly dealNotes: DealNotesService,
    private readonly companies: CompaniesService,
    private readonly contacts: ContactsService,
    private readonly documents: DocumentsService,
    private readonly activities: ActivitiesService,
    private readonly users: UsersService,
    private readonly pipeline: PipelineService,
    private readonly wiki: WikiService,
    private readonly chat: ChatService,
  ) {
    this.baseUrl = (
      config.get<string>('WEB_BASE_URL') ?? 'https://crm.symph.co'
    ).replace(/\/+$/, '')
  }

  /** Build a direct CRM link for the given entity type and ID. */
  private crmUrl(type: 'deal' | 'company' | 'contact', id: string, companyId?: string): string {
    switch (type) {
      case 'deal':
        return `${this.baseUrl}/deals/${id}`
      case 'company':
        return `${this.baseUrl}/wiki/brand/${id}`
      case 'contact':
        return companyId
          ? `${this.baseUrl}/wiki/brand/${companyId}`
          : `${this.baseUrl}/wiki/brand`
    }
  }

  /**
   * Resolve performer identity from request headers.
   * Defaults to 'owner' as source when no X-Performed-By is present.
   */
  private resolvePerformer(headers: Record<string, string | string[] | undefined>) {
    const performedBy = (headers['x-performed-by'] as string) || undefined
    const performerName = (headers['x-performed-by-name'] as string) || 'Owner'
    return { performedBy, performerName, source: 'owner' as const }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Health
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/owner/ping — Verify connectivity and key validity */
  @Get('ping')
  ping() {
    return { ok: true, service: 'symph-crm', auth: 'owner', ts: new Date().toISOString() }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/owner/pipeline — Pipeline summary */
  @Get('pipeline')
  async pipelineBasic() {
    return this.pipeline.getSummary({})
  }

  /** GET /api/owner/pipeline/summary — Full summary with optional date range */
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

  /** GET /api/owner/deals — List with optional filters */
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

  /** GET /api/owner/deals/:id — Full deal + context.md + activities + documents */
  @Get('deals/:id')
  async getDeal(@Param('id') id: string) {
    const deal = await this.deals.findOne(id)
    if (!deal) throw new NotFoundException(`Deal ${id} not found`)

    const [dealDocs, recentActivities] = await Promise.all([
      this.documents.findByDeal(id),
      this.activities.findByDeal(id, 20),
    ])

    const contextDoc = dealDocs.find((d: any) => d.type === 'context')
    let contextMarkdown: string | null = null
    if (contextDoc) {
      contextMarkdown = await this.documents.readContent(contextDoc.id).catch(() => null)
    }

    return { deal, contextMarkdown, documents: dealDocs, recentActivities }
  }

  /** POST /api/owner/deals — Create a new deal */
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
      internalProductId?: string
      tierId?: string
      [key: string]: unknown
    },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const deal = await this.deals.create(body as any, performedBy)
    return { ok: true, deal, url: this.crmUrl('deal', deal.id) }
  }

  /** PATCH /api/owner/deals/:id — Update deal fields */
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

    const updatableFields = ['value', 'title', 'notes', 'assignedTo', 'companyId', 'internalProductId', 'tierId'] as const
    const otherFields = Object.fromEntries(
      Object.entries(rest).filter(([k]) => (updatableFields as readonly string[]).includes(k)),
    )
    if (Object.keys(otherFields).length > 0) {
      await this.deals.update(id, otherFields as any, performedBy)
    }

    const updated = await this.deals.findOne(id)
    return { ok: true, deal: updated, url: this.crmUrl('deal', id) }
  }

  /** PATCH /api/owner/deals/:id/stage — Explicit stage transition */
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
    return { ok: true, deal: updated, url: this.crmUrl('deal', id) }
  }

  /** PATCH /api/owner/deals/:id/assign — Reassign deal to a user */
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
    return { ok: true, deal: updated, url: this.crmUrl('deal', id) }
  }

  /** DELETE /api/owner/deals/:id — Remove deal */
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
  // Deal Notes & Summaries
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/owner/deals/:id/notes — Get all notes flat */
  @Get('deals/:id/notes')
  async getDealNotes(@Param('id') id: string) {
    return this.dealNotes.getNotesFlat(id)
  }

  /** POST /api/owner/deals/:id/notes — Create a note */
  @Post('deals/:id/notes')
  @HttpCode(HttpStatus.OK)
  async createDealNote(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: { type: string; title: string; content: string; authorId?: string },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const authorId = body.authorId || performedBy || null
    const note = await this.dealNotes.saveNote(id, body.type, body.title, body.content, authorId)
    return { ok: true, note, url: this.crmUrl('deal', id) }
  }

  /** GET /api/owner/deals/:id/summaries — List all summaries */
  @Get('deals/:id/summaries')
  async listDealSummaries(@Param('id') id: string) {
    return this.dealNotes.listSummaries(id)
  }

  /** GET /api/owner/deals/:id/summaries/:filename — Read a specific summary */
  @Get('deals/:id/summaries/:filename')
  async readDealSummary(@Param('id') id: string, @Param('filename') filename: string) {
    const result = await this.dealNotes.readSummary(id, filename)
    if (!result) throw new NotFoundException(`Summary ${filename} not found for deal ${id}`)
    return result
  }

  /** POST /api/owner/deals/:id/summaries — Write a new summary */
  @Post('deals/:id/summaries')
  @HttpCode(HttpStatus.OK)
  async writeDealSummary(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() body: { summary: string; nextSteps: string[]; notesIncluded: number },
  ) {
    const { performedBy } = this.resolvePerformer(headers)
    const meta = await this.dealNotes.writeSummary(
      id,
      body.summary,
      body.nextSteps,
      body.notesIncluded,
      performedBy,
    )
    return { ok: true, ...meta, url: this.crmUrl('deal', id) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Companies
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/owner/companies — List or search */
  @Get('companies')
  async listCompanies(@Query('search') search?: string) {
    if (search) return this.companies.search(search)
    return this.companies.findAll()
  }

  /** GET /api/owner/companies/:id — Company + deals + contacts + documents */
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

  /** POST /api/owner/companies — Create a new company */
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
    return { ok: true, company, url: this.crmUrl('company', company.id) }
  }

  /** PUT /api/owner/companies/:id — Update company */
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
    return { ok: true, company: updated, url: this.crmUrl('company', id) }
  }

  /** DELETE /api/owner/companies/:id — Remove company */
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

  /** GET /api/owner/contacts — List with optional filters */
  @Get('contacts')
  async listContacts(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.contacts.findAll({ search, companyId })
  }

  /** GET /api/owner/contacts/:id — Single contact */
  @Get('contacts/:id')
  async getContact(@Param('id') id: string) {
    const contact = await this.contacts.findOne(id)
    if (!contact) throw new NotFoundException(`Contact ${id} not found`)
    return contact
  }

  /** POST /api/owner/contacts — Create contact */
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
    return { ok: true, contact, url: this.crmUrl('contact', contact.id, contact.companyId ?? body.companyId) }
  }

  /** PUT /api/owner/contacts/:id — Update contact */
  @Put('contacts/:id')
  async updateContact(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; phone?: string; role?: string; companyId?: string; [key: string]: unknown },
  ) {
    const contact = await this.contacts.findOne(id)
    if (!contact) throw new NotFoundException(`Contact ${id} not found`)
    const updated = await this.contacts.update(id, body as any)
    return { ok: true, contact: updated, url: this.crmUrl('contact', id, (updated as any).companyId ?? body.companyId) }
  }

  /** DELETE /api/owner/contacts/:id — Remove contact */
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

  /** GET /api/owner/activities — List with filters */
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

  /** GET /api/owner/activities/deal/:dealId — Activities for a deal */
  @Get('activities/deal/:dealId')
  async activitiesByDeal(
    @Param('dealId') dealId: string,
    @Query('limit') limit?: string,
  ) {
    return this.activities.findByDeal(dealId, limit ? parseInt(limit, 10) : 50)
  }

  /** GET /api/owner/activities/company/:companyId — Activities for a company */
  @Get('activities/company/:companyId')
  async activitiesByCompany(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.activities.findByCompany(companyId, limit ? parseInt(limit, 10) : 50)
  }

  /** POST /api/owner/activities — Log an activity */
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

  /** GET /api/owner/documents — List by deal or company */
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

  /** GET /api/owner/documents/:id — Document metadata */
  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    const doc = await this.documents.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)
    return doc
  }

  /** GET /api/owner/documents/:id/content — Read markdown content from Storage */
  @Get('documents/:id/content')
  async getDocumentContent(@Param('id') id: string) {
    const content = await this.documents.readContent(id)
    return { id, content }
  }

  /** POST /api/owner/documents — Create a document */
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

    let authorId = body.authorId ?? performedBy
    if (!authorId || !authorId.match(/^[0-9a-f-]{8,}$/i)) {
      const allUsers = await this.users.findAll()
      const fallback = allUsers.find((u: any) => u.role === 'SALES') ?? allUsers[0]
      authorId = fallback?.id ?? 'admin-001'
    }

    const doc = await this.documents.create(
      { ...body, authorId, isAiGenerated: body.isAiGenerated ?? false } as any,
      performedBy,
    )
    return { ok: true, document: doc }
  }

  /** PUT /api/owner/documents/:id — Update document */
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

  /** DELETE /api/owner/documents/:id — Soft-delete document */
  @Delete('documents/:id')
  async removeDocument(@Param('id') id: string) {
    const doc = await this.documents.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)
    await this.documents.remove(id)
    return { ok: true, deleted: id }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Users (read-only)
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/owner/users — List all CRM users */
  @Get('users')
  async listUsers() {
    return this.users.findAll()
  }

  /** GET /api/owner/users/by-discord/:discordId — Find user by Discord ID */
  @Get('users/by-discord/:discordId')
  async findByDiscordId(@Param('discordId') discordId: string) {
    const user = await this.users.findByDiscordId(discordId)
    if (!user) throw new NotFoundException(`No user linked to Discord ID ${discordId}`)
    return user
  }

  /** GET /api/owner/users/:id — Single user */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.users.findOne(id)
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return user
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Wiki
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/owner/wiki/index */
  @Get('wiki/index')
  async getWikiIndex(
    @Query('scope') scope: 'global' | 'deal' | 'company' | 'person' = 'global',
    @Query('id') id?: string,
  ) {
    const content = await this.wiki.readIndex(scope, id)
    return { scope, id: id ?? null, content }
  }

  /** GET /api/owner/wiki/page */
  @Get('wiki/page')
  async getWikiPage(@Query('path') relativePath: string) {
    if (!relativePath) return { path: null, content: null, error: 'path query param required' }
    const content = await this.wiki.readPage(relativePath)
    return { path: relativePath, content }
  }

  /** POST /api/owner/wiki/page */
  @Post('wiki/page')
  @HttpCode(HttpStatus.OK)
  async writeWikiPage(
    @Body() body: { path: string; content: string; append?: boolean },
  ) {
    if (!body.path || body.content === undefined) {
      return { ok: false, error: 'path and content are required' }
    }
    if (body.append) {
      await this.wiki.appendPage(body.path, body.content)
      return { ok: true, path: body.path, action: 'appended' }
    }
    await this.wiki.writePage(body.path, body.content)
    return { ok: true, path: body.path, action: 'written' }
  }

  /** POST /api/owner/wiki/log */
  @Post('wiki/log')
  @HttpCode(HttpStatus.OK)
  async appendWikiLog(
    @Body() body: {
      entry: string
      operation?: string
      actor?: string
      scope?: 'global' | 'deal' | 'company' | 'person'
      scopeId?: string
    },
  ) {
    if (!body.entry) return { ok: false, error: 'entry is required' }
    await this.wiki.appendLog({
      entry: body.entry,
      operation: body.operation,
      actor: body.actor ?? 'owner',
      scope: body.scope,
      scopeId: body.scopeId,
    })
    return { ok: true }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Chat
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/owner/chats?userId=... — List chat sessions for a user.
   * Pass userId (CRM user UUID) to scope sessions. Omit for all sessions.
   */
  @Get('chats')
  async listChatSessions(@Query('userId') userId?: string) {
    if (!userId) return { sessions: [] }
    return { sessions: await this.chat.listSessions(userId) }
  }

  /** GET /api/owner/chats/:sessionId/messages — Full message history for a session */
  @Get('chats/:sessionId/messages')
  async getChatHistory(@Param('sessionId') sessionId: string) {
    const messages = await this.chat.getHistory(sessionId)
    return { sessionId, messages }
  }

  /**
   * POST /api/owner/chats/message — Send a message to Aria via the CRM chat.
   *
   * Body:
   *   userId       string  CRM user UUID (required)
   *   workspaceId  string  CRM workspace UUID (required)
   *   content      string  Message text (required)
   *   sessionId?   string  Existing session — omit to start a new one
   *   dealId?      string  Deal context for the conversation
   */
  @Post('chats/message')
  async sendChatMessage(
    @Body() body: {
      userId: string
      workspaceId: string
      content: string
      sessionId?: string
      dealId?: string
    },
  ) {
    const result = await this.chat.sendMessage({
      sessionId: body.sessionId,
      dealId: body.dealId,
      workspaceId: body.workspaceId,
      userId: body.userId,
      content: body.content,
    })
    return result
  }
}
