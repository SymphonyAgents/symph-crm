import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { eq, desc } from 'drizzle-orm'
import {
  chatSessions,
  chatMessages,
  deals,
  products,
  tiers,
  contacts,
  activities,
} from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { CompaniesService } from '../companies/companies.service'
import { DocumentsService } from '../documents/documents.service'
import { ContactsService } from '../contacts/contacts.service'
import { ActivitiesService } from '../activities/activities.service'
import { DealsService } from '../deals/deals.service'

export type MessageRole = 'user' | 'assistant'

export interface AttachmentContext {
  type: 'file' | 'image' | 'voice'
  filename: string
  // For file and voice: extracted text content
  text?: string
  // For image: raw bytes for Claude vision (passed as base64 content block)
  imageData?: {
    base64: string
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  }
}

export interface ChatMessageDto {
  sessionId?: string
  dealId?: string
  workspaceId: string
  userId: string
  content: string
  role?: MessageRole
  // Set by ChatController after pre-processing any uploaded attachment
  attachmentContext?: AttachmentContext
}

export interface ChatResponseDto {
  sessionId: string
  messageId: string
  reply: string
  actionsTaken: ActionRecord[]
}

export interface ActionRecord {
  tool: string
  input: Record<string, unknown>
  result: Record<string, unknown>
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'search_companies',
    description: 'Search for companies by name or domain. Returns up to 20 matches.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Company name or domain to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_company',
    description: 'Create a new company record.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        domain: { type: 'string', description: 'Primary domain, e.g. acme.com' },
        industry: { type: 'string' },
        website: { type: 'string' },
        hqLocation: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_products_and_tiers',
    description: 'List all available Symph products and pricing tiers. Always call this before creating a deal to get valid product_id and tier_id values.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'create_deal',
    description: 'Create a new deal. You MUST have a valid company_id, product_id, and tier_id before calling this.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string', description: 'UUID of the company' },
        productId: { type: 'string', description: 'UUID from list_products_and_tiers' },
        tierId: { type: 'string', description: 'UUID from list_products_and_tiers' },
        title: { type: 'string', description: 'Short deal title, e.g. "ACME Corp – Web App Build"' },
        stage: {
          type: 'string',
          enum: ['lead', 'discovery', 'assessment', 'proposal_demo', 'followup', 'closed_won', 'closed_lost'],
          description: 'Initial pipeline stage. Defaults to lead.',
        },
        value: { type: 'number', description: 'Deal value in PHP' },
        outreachCategory: { type: 'string', enum: ['inbound', 'outbound'] },
        servicesTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Services involved e.g. ["Web App", "AI Integration"]',
        },
        assignedTo: { type: 'string', description: 'User ID of the AM to assign' },
      },
      required: ['companyId', 'productId', 'tierId', 'title'],
    },
  },
  {
    name: 'update_deal',
    description: 'Update deal fields — stage, value, close date, probability, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string' },
        stage: { type: 'string' },
        value: { type: 'number' },
        probability: { type: 'number' },
        closeDate: { type: 'string', description: 'ISO date, e.g. 2025-06-30' },
        lossReason: { type: 'string' },
        isFlagged: { type: 'boolean' },
        flagReason: { type: 'string' },
      },
      required: ['dealId'],
    },
  },
  {
    name: 'get_deal',
    description: 'Get full details for a deal by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string' },
      },
      required: ['dealId'],
    },
  },
  {
    name: 'list_deals',
    description: 'List recent deals, optionally filtered by stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stage: { type: 'string', description: 'Filter by pipeline stage' },
        limit: { type: 'number', description: 'Max results, default 10' },
      },
    },
  },
  {
    name: 'write_deal_context',
    description: 'Write or update the AI-maintained context document for a deal. This is the living record — use it to capture discovery insights, company background, meeting notes, next steps, etc. Content is markdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string' },
        content: {
          type: 'string',
          description: 'Full markdown content for the deal context. This REPLACES the existing content.',
        },
      },
      required: ['dealId', 'content'],
    },
  },
  {
    name: 'read_deal_context',
    description: 'Read the current context document for a deal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string' },
      },
      required: ['dealId'],
    },
  },
  {
    name: 'log_activity',
    description: 'Log an activity against a deal or company.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string' },
        companyId: { type: 'string' },
        type: {
          type: 'string',
          enum: [
            'deal_created', 'deal_stage_changed', 'deal_updated', 'deal_value_changed',
            'note_added', 'note_updated', 'file_uploaded', 'contact_added',
            'company_created', 'company_updated', 'customization_requested',
            'pitch_created', 'am_assigned', 'deal_flagged', 'deal_unflagged',
            'deal_won', 'deal_lost', 'proposal_created', 'proposal_sent', 'attachment_added',
          ],
        },
        summary: { type: 'string', description: 'What happened' },
        metadata: { type: 'object', description: 'Any extra structured data' },
      },
      required: ['type', 'summary'],
    },
  },
  {
    name: 'add_contact',
    description: 'Add a contact (POC) to a company.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        title: { type: 'string' },
        isPrimary: { type: 'boolean' },
      },
      required: ['companyId', 'name'],
    },
  },
  {
    name: 'get_company',
    description: 'Get full details for a specific company by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string', description: 'UUID of the company' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'update_company',
    description: 'Update company fields — name, industry, website, HQ location, description, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string' },
        name: { type: 'string' },
        domain: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
        hqLocation: { type: 'string' },
        description: { type: 'string' },
        headcountRange: { type: 'string', description: 'e.g. "100-500"' },
        revenueRange: { type: 'string', description: 'e.g. "₱50M-₱200M"' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'list_deals_for_company',
    description: 'List all deals associated with a specific company.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string', description: 'UUID of the company' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_contacts',
    description: 'Get all contacts (POCs) for a specific company, with primary contacts first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string', description: 'UUID of the company' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'search_deals',
    description: 'Search and filter deals by title, stage, or company. Use this to find a deal when you know its name but not its ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Fuzzy search by deal title' },
        stage: { type: 'string', description: 'Filter by pipeline stage' },
        companyId: { type: 'string', description: 'Filter by company UUID' },
        limit: { type: 'number', description: 'Max results, default 20' },
      },
    },
  },
  {
    name: 'list_activities',
    description: 'Get the activity log for a deal or company. Shows what happened and when.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: { type: 'string', description: 'UUID of the deal' },
        companyId: { type: 'string', description: 'UUID of the company' },
        limit: { type: 'number', description: 'Max results, default 20' },
      },
    },
  },
]

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Aria, an AI sales assistant for Symph — an AI-native software engineering agency based in the Philippines.

Your job is to help Account Managers (AMs) manage their pipeline through natural conversation. You have tools to search companies, create and update deals, log activities, and maintain a living context document per deal.

## Core principles
- Be concise and action-oriented. The AM is busy.
- When an AM mentions a deal or client interaction, immediately capture it — search for the company, create/update the deal, log the activity, and update the deal context.
- Always call list_products_and_tiers before creating a deal so you have valid IDs. Use "Custom Project" + "Standard" as defaults if the AM doesn't specify.
- After capturing information, summarize what you did: "Got it — I've logged your call with Acme Corp, updated the deal to Discovery stage, and noted the budget concern in the context doc."
- Ask a clarifying question only when critical info is missing (company name, deal value when closing). Don't interrogate.
- Currency is PHP (Philippine Peso). Format values without currency symbol in tool calls.
- Dates use ISO format (YYYY-MM-DD).

## Deal context document
Each deal has a markdown context doc at deals/{dealId}/context.md. This is the living record of everything known about the deal. When you learn new things from an AM, append or update the relevant section. Structure it with headings: ## Overview, ## Company Background, ## Key Contacts, ## Discovery Notes, ## Proposal/Pricing, ## Next Steps, ## Risks & Concerns.

## Current session
Workspace: {workspaceId}
AM User ID: {userId}
{dealContext}`

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private anthropic: Anthropic

  constructor(
    private config: ConfigService,
    @Inject(DB) private db: Database,
    private companies: CompaniesService,
    private documentsService: DocumentsService,
    private contactsService: ContactsService,
    private activitiesService: ActivitiesService,
    private dealsService: DealsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    })
  }

  // ─── Session management ──────────────────────────────────────────────────

  async getOrCreateSession(params: {
    sessionId?: string
    dealId?: string
    workspaceId: string
    userId: string
  }) {
    if (params.sessionId) {
      const [session] = await this.db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, params.sessionId))
        .limit(1)
      if (session) return session
    }

    const [session] = await this.db
      .insert(chatSessions)
      .values({
        workspaceId: params.workspaceId,
        userId: params.userId,
        // chatSessions uses contextType + contextId (not dealId directly)
        contextType: params.dealId ? 'deal' : 'global',
        contextId: params.dealId ?? null,
        title: params.dealId ? 'Deal chat' : 'General chat',
      })
      .returning()
    return session
  }

  async getHistory(sessionId: string) {
    return this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
  }

  // ─── Main send message flow ──────────────────────────────────────────────

  async sendMessage(dto: ChatMessageDto): Promise<ChatResponseDto> {
    const session = await this.getOrCreateSession({
      sessionId: dto.sessionId,
      dealId: dto.dealId,
      workspaceId: dto.workspaceId,
      userId: dto.userId,
    })

    // Store user message (userId is required by schema)
    const [userMsg] = await this.db
      .insert(chatMessages)
      .values({
        sessionId: session.id,
        userId: dto.userId,
        role: 'user',
        content: dto.content,
      })
      .returning()

    // Load history for context (last 40 messages)
    const history = await this.getHistory(session.id)
    const anthropicMessages: Anthropic.Messages.MessageParam[] = history
      .slice(0, -1) // exclude the message we just inserted (it's added below)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    // Build the user turn — multimodal when an image is attached
    const att = dto.attachmentContext
    if (att?.type === 'image' && att.imageData) {
      // Pass image directly to Claude as a vision content block
      const fallbackText = dto.content?.trim() || 'What do you see in this image? Is there anything useful for our CRM (contacts, company info, deal details)?'
      anthropicMessages.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: att.imageData.mediaType,
              data: att.imageData.base64,
            },
          },
          { type: 'text', text: fallbackText },
        ],
      })
    } else if (att?.type === 'voice' && att.text) {
      // Inject transcript as labelled context block
      const userText = dto.content?.trim()
      const voiceBlock = `[Voice note transcribed]\n<transcript>\n${att.text}\n</transcript>`
      const combined = userText ? `${userText}\n\n${voiceBlock}` : voiceBlock
      anthropicMessages.push({ role: 'user', content: combined })
    } else if (att?.type === 'file' && att.text) {
      // Inject extracted file text as labelled context block (truncated to 4000 chars to respect context limits)
      const userText = dto.content?.trim()
      const fileBlock = `[Attached file: ${att.filename}]\n<file_content>\n${att.text.slice(0, 4000)}\n</file_content>`
      const combined = userText ? `${userText}\n\n${fileBlock}` : fileBlock
      anthropicMessages.push({ role: 'user', content: combined })
    } else {
      anthropicMessages.push({ role: 'user', content: dto.content })
    }

    // Build system prompt with context
    // contextId holds the deal UUID when contextType === 'deal'
    const activeDealId = session.contextType === 'deal' ? session.contextId : dto.dealId ?? null
    let dealContext = ''
    if (activeDealId) {
      const dealCtxDoc = await this.documentsService.findByDeal(activeDealId)
      const ctxDoc = dealCtxDoc.find(d => d.type === 'context')
      if (ctxDoc) {
        const content = await this.documentsService.readContent(ctxDoc.id)
        if (content) dealContext = `\n## Active deal context\n${content.slice(0, 2000)}`
      }
      dealContext = `Active deal ID: ${activeDealId}${dealContext}`
    }

    const systemPrompt = SYSTEM_PROMPT
      .replace('{workspaceId}', dto.workspaceId)
      .replace('{userId}', dto.userId)
      .replace('{dealContext}', dealContext)

    // Agentic loop
    const actionsTaken: ActionRecord[] = []
    let finalReply = ''
    const loopMessages = [...anthropicMessages]

    for (let i = 0; i < 10; i++) {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages: loopMessages,
      })

      // Check if we should stop
      if (response.stop_reason === 'end_turn') {
        finalReply = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.Messages.TextBlock).text)
          .join('')
        break
      }

      if (response.stop_reason === 'tool_use') {
        // Add assistant message with tool calls to loop
        loopMessages.push({ role: 'assistant', content: response.content })

        // Execute all tool calls
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue

          const toolInput = block.input as Record<string, unknown>
          let result: Record<string, unknown>

          try {
            result = await this.executeTool(block.name, toolInput, {
              workspaceId: dto.workspaceId,
              userId: dto.userId,
              dealId: activeDealId ?? undefined,
            })
          } catch (err) {
            result = { error: (err as Error).message }
          }

          actionsTaken.push({ tool: block.name, input: toolInput, result })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }

        loopMessages.push({ role: 'user', content: toolResults })
        continue
      }

      // Unexpected stop reason
      finalReply = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.Messages.TextBlock).text)
        .join('')
      break
    }

    // Store assistant reply — actionsTaken stored in the jsonb column
    const [assistantMsg] = await this.db
      .insert(chatMessages)
      .values({
        sessionId: session.id,
        userId: dto.userId,
        role: 'assistant',
        content: finalReply,
        actionsTaken: actionsTaken.length > 0 ? actionsTaken : [],
      })
      .returning()

    return {
      sessionId: session.id,
      messageId: assistantMsg.id,
      reply: finalReply,
      actionsTaken,
    }
  }

  // ─── Tool executor ──────────────────────────────────────────────────────

  private async executeTool(
    name: string,
    input: Record<string, unknown>,
    ctx: { workspaceId: string; userId: string; dealId?: string },
  ): Promise<Record<string, unknown>> {
    switch (name) {
      case 'search_companies': {
        const results = await this.companies.search(input.query as string)
        return { companies: results }
      }

      case 'create_company': {
        const { company, created } = await this.companies.findOrCreate({
          name: input.name as string,
          domain: input.domain as string | undefined,
          industry: input.industry as string | undefined,
          website: input.website as string | undefined,
          hqLocation: input.hqLocation as string | undefined,
          description: input.description as string | undefined,
          workspaceId: ctx.workspaceId,
          createdBy: ctx.userId,
        })
        return { company, created }
      }

      case 'list_products_and_tiers': {
        const [allProducts, allTiers] = await Promise.all([
          this.db.select().from(products).orderBy(products.sortOrder),
          this.db.select().from(tiers).orderBy(tiers.sortOrder),
        ])
        return { products: allProducts, tiers: allTiers }
      }

      case 'create_deal': {
        type DealStage = typeof deals.$inferInsert['stage']
        type DealInsert = typeof deals.$inferInsert
        const newDeal: DealInsert = {
          companyId: input.companyId as string,
          productId: input.productId as string,
          tierId: input.tierId as string,
          title: input.title as string,
          stage: ((input.stage as string | undefined) ?? 'lead') as DealStage,
          value: input.value ? String(input.value) : undefined,
          outreachCategory: input.outreachCategory as 'inbound' | 'outbound' | undefined,
          servicesTags: (input.servicesTags as string[] | undefined) ?? [],
          assignedTo: (input.assignedTo as string | undefined) ?? ctx.userId,
          createdBy: ctx.userId,
          workspaceId: ctx.workspaceId,
        }
        const [deal] = await this.db.insert(deals).values(newDeal).returning()
        return { deal }
      }

      case 'update_deal': {
        const patch: Partial<typeof deals.$inferInsert> = {
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        }
        if (input.stage) patch.stage = input.stage as typeof deals.$inferInsert['stage']
        if (input.value !== undefined) patch.value = String(input.value)
        if (input.probability !== undefined) patch.probability = input.probability as number
        if (input.closeDate) patch.closeDate = input.closeDate as string
        if (input.lossReason) patch.lossReason = input.lossReason as string
        if (input.isFlagged !== undefined) patch.isFlagged = input.isFlagged as boolean
        if (input.flagReason) patch.flagReason = input.flagReason as string

        const [deal] = await this.db
          .update(deals)
          .set(patch)
          .where(eq(deals.id, input.dealId as string))
          .returning()
        return { deal }
      }

      case 'get_deal': {
        const [deal] = await this.db
          .select()
          .from(deals)
          .where(eq(deals.id, input.dealId as string))
          .limit(1)
        return { deal: deal ?? null }
      }

      case 'list_deals': {
        const limit = (input.limit as number | undefined) ?? 10
        let query = this.db.select().from(deals).orderBy(desc(deals.updatedAt)).limit(limit)
        // Note: conditional where on stage would require dynamic query building
        // For now return all and filter in JS when stage is specified
        const results = await query
        const filtered = input.stage
          ? results.filter(d => d.stage === input.stage)
          : results
        return { deals: filtered.slice(0, limit) }
      }

      case 'write_deal_context': {
        const doc = await this.documentsService.upsertDealContext({
          dealId: input.dealId as string,
          workspaceId: ctx.workspaceId,
          authorId: ctx.userId,
          content: input.content as string,
        })
        return { document: doc, success: true }
      }

      case 'read_deal_context': {
        const docs = await this.documentsService.findByDeal(input.dealId as string)
        const ctxDoc = docs.find(d => d.type === 'context')
        if (!ctxDoc) return { content: null, message: 'No context document found yet' }
        const content = await this.documentsService.readContent(ctxDoc.id)
        return { content, documentId: ctxDoc.id }
      }

      case 'log_activity': {
        const [activity] = await this.db
          .insert(activities)
          .values({
            dealId: (input.dealId as string | undefined) ?? ctx.dealId,
            companyId: input.companyId as string | undefined,
            actorId: ctx.userId,
            workspaceId: ctx.workspaceId,
            type: input.type as typeof activities.$inferInsert['type'],
            metadata: {
              summary: input.summary,
              ...(input.metadata as Record<string, unknown> | undefined ?? {}),
            },
          })
          .returning()
        return { activity }
      }

      case 'add_contact': {
        const [contact] = await this.db
          .insert(contacts)
          .values({
            companyId: input.companyId as string,
            name: input.name as string,
            email: input.email as string | undefined,
            phone: input.phone as string | undefined,
            title: input.title as string | undefined,
            isPrimary: (input.isPrimary as boolean | undefined) ?? false,
          })
          .returning()
        return { contact }
      }

      case 'get_company': {
        const company = await this.companies.findOne(input.companyId as string)
        return { company: company ?? null }
      }

      case 'update_company': {
        const { companyId, ...fields } = input as Record<string, string>
        const updated = await this.companies.update(companyId, {
          ...fields,
          updatedAt: new Date(),
        })
        return { company: updated }
      }

      case 'list_deals_for_company': {
        const companyDeals = await this.dealsService.findByCompany(input.companyId as string)
        return { deals: companyDeals }
      }

      case 'get_contacts': {
        const companyContacts = await this.contactsService.findByCompany(input.companyId as string)
        return { contacts: companyContacts }
      }

      case 'search_deals': {
        const results = await this.dealsService.findAll({
          search: input.search as string | undefined,
          stage: input.stage as string | undefined,
          companyId: input.companyId as string | undefined,
          limit: (input.limit as number | undefined) ?? 20,
        })
        return { deals: results }
      }

      case 'list_activities': {
        const limit = (input.limit as number | undefined) ?? 20
        const results = await this.activitiesService.find({
          dealId: input.dealId as string | undefined,
          companyId: input.companyId as string | undefined,
          limit,
        })
        return { activities: results }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }
}
