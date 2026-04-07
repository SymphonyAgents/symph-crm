import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { chatSessions, chatMessages } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { DocumentsService } from '../documents/documents.service'

export type MessageRole = 'user' | 'assistant'

export interface AttachmentContext {
  type: 'file' | 'image' | 'voice'
  filename: string
  // For file and voice: extracted text content
  text?: string
  // For voice: the persisted file ID — enables playback + retry without re-recording
  fileId?: string
  // For image: raw bytes (base64) — Aria gateway doesn't accept multimodal, noted inline
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

// ─── CRM system prompt injected into every Aria session ──────────────────────

const CRM_SYSTEM_PROMPT = `## Symph CRM Assistant

You are Aria, acting as a CRM sales assistant for Symph — an AI-native software engineering agency based in the Philippines. Help Account Managers (AMs) track deals, manage companies, and capture client interactions.

## Guidelines
- Be concise and action-oriented. AMs are busy.
- Currency is PHP (Philippine Peso). Format large values clearly (e.g. ₱2.5M).
- When an AM describes a client interaction, help them capture it and decide what to update in the CRM.
- Confirm what you did after using any CRM tools: "Got it — I looked up Acme Corp and here's their current status..."
- Dates use ISO format (YYYY-MM-DD).
- After any create or update operation (deal, company, or contact), the tool result will include a \`url\` field. Always include that link in your response so the user can navigate directly to the record. Format it as a clickable markdown link, e.g. "View the deal here: [Acme Corp Deal](https://crm.symph.co/deals/abc123)".`

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly gatewayUrl: string
  private readonly apiToken: string
  private readonly internalSecret: string | undefined
  private readonly internalApiBase = 'https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api/internal'

  constructor(
    private config: ConfigService,
    @Inject(DB) private db: Database,
    private documentsService: DocumentsService,
  ) {
    this.gatewayUrl = (
      config.get<string>('ARIA_GATEWAY_URL') ?? 'https://aria-gateway.symph.co'
    ).replace(/\/+$/, '')
    this.apiToken = config.get<string>('ARIA_API_TOKEN') ?? ''
    this.internalSecret = config.get<string>('INTERNAL_SECRET')
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
        contextType: params.dealId ? 'deal' : 'global',
        contextId: params.dealId ?? null,
        title: params.dealId ? 'Deal chat' : 'General chat',
      })
      .returning()
    return session
  }

  async listSessions(userId: string) {
    const { desc } = await import('drizzle-orm')
    return this.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt))
  }

  async createSession(params: {
    userId: string
    workspaceId: string
    dealId?: string
    title?: string
  }) {
    const [session] = await this.db
      .insert(chatSessions)
      .values({
        workspaceId: params.workspaceId,
        userId: params.userId,
        contextType: params.dealId ? 'deal' : 'global',
        contextId: params.dealId ?? null,
        title: params.title ?? 'New chat',
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

  async saveUserMessage(sessionId: string, userId: string, userMessage: string): Promise<{ id: string }> {
    await this.db.update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))

    const [msg] = await this.db.insert(chatMessages).values({
      sessionId,
      userId,
      role: 'user',
      content: userMessage,
    }).returning()
    return { id: msg.id }
  }

  async saveAssistantMessage(sessionId: string, userId: string, assistantMessage: string): Promise<void> {
    await this.db.update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))

    await this.db.insert(chatMessages).values({
      sessionId,
      userId,
      role: 'assistant',
      content: assistantMessage,
      actionsTaken: [],
    })
  }

  async saveMessages(sessionId: string, userId: string, userMessage: string, assistantMessage: string) {
    // Update session updatedAt
    await this.db.update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))

    await this.db.insert(chatMessages).values([
      { sessionId, userId, role: 'user', content: userMessage },
      { sessionId, userId, role: 'assistant', content: assistantMessage },
    ])
  }

  async deleteSession(sessionId: string) {
    await this.db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId))
    await this.db.delete(chatSessions).where(eq(chatSessions.id, sessionId))
    return { deleted: true }
  }

  // ─── Main send message flow ──────────────────────────────────────────────

  async sendMessage(dto: ChatMessageDto): Promise<ChatResponseDto> {
    const session = await this.getOrCreateSession({
      sessionId: dto.sessionId,
      dealId: dto.dealId,
      workspaceId: dto.workspaceId,
      userId: dto.userId,
    })

    // Build user-facing message content (inline any attachment context as text)
    const userContent = this.buildUserContent(dto)

    // Store user message
    await this.db.insert(chatMessages).values({
      sessionId: session.id,
      userId: dto.userId,
      role: 'user',
      content: dto.content,
    })

    // Build system prompt additions with CRM context
    const activeDealId =
      session.contextType === 'deal' ? session.contextId : (dto.dealId ?? null)
    const systemPromptAdditions = await this.buildSystemPromptAdditions(dto, activeDealId)

    // Send to Aria gateway — session namespaced to this CRM chat session
    const ariaSessionId = `crm-${session.id}`

    const sendResp = await fetch(`${this.gatewayUrl}/v1/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        session_id: ariaSessionId,
        content: userContent,
        user_id: dto.userId,
        // Assert T3 so system_prompt_additions is honoured by the gateway
        user_tier: 3,
        workspace_path: '/share/agency/products/symph-crm',
        system_prompt_additions: systemPromptAdditions,
      }),
    })

    if (!sendResp.ok) {
      const errText = await sendResp.text()
      throw new Error(`Aria gateway error: ${sendResp.status} ${errText}`)
    }

    const { seq: startSeq } = (await sendResp.json()) as {
      session_id: string
      seq: number
    }

    // Poll history until Aria finishes — start from seq 0 (outbox seq, not inbox seq)
    const reply = await this.pollForReply(ariaSessionId, 0)

    // Store assistant reply
    const [assistantMsg] = await this.db
      .insert(chatMessages)
      .values({
        sessionId: session.id,
        userId: dto.userId,
        role: 'assistant',
        content: reply,
        actionsTaken: [],
      })
      .returning()

    return {
      sessionId: session.id,
      messageId: assistantMsg.id,
      reply,
      actionsTaken: [],
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private buildUserContent(dto: ChatMessageDto): string {
    const att = dto.attachmentContext
    if (!att) return dto.content

    const userText = dto.content?.trim() ?? ''

    if (att.type === 'voice' && att.text) {
      const voiceBlock = `[Voice note transcribed]\n<transcript>\n${att.text}\n</transcript>`
      return userText ? `${userText}\n\n${voiceBlock}` : voiceBlock
    }

    if (att.type === 'file' && att.text) {
      const fileBlock = `[Attached file: ${att.filename}]\n<file_content>\n${att.text.slice(0, 4000)}\n</file_content>`
      return userText ? `${userText}\n\n${fileBlock}` : fileBlock
    }

    if (att.type === 'image') {
      // Aria gateway does not accept raw base64 blobs; note the image inline
      const imageNote = `[Image attached: ${att.filename}]`
      return userText ? `${userText}\n\n${imageNote}` : imageNote
    }

    return dto.content
  }

  private async buildSystemPromptAdditions(
    dto: ChatMessageDto,
    activeDealId: string | null,
  ): Promise<string> {
    const lines: string[] = [CRM_SYSTEM_PROMPT]

    lines.push(`\n## Session context`)
    lines.push(`- User ID: ${dto.userId}`)
    lines.push(`- Workspace: ${dto.workspaceId}`)
    lines.push(`- Active deal: ${activeDealId ?? 'none'}`)

    // Inject deal context document if available
    if (activeDealId) {
      try {
        const docs = await this.documentsService.findByDeal(activeDealId)
        const ctxDoc = docs.find(d => d.type === 'context')
        if (ctxDoc) {
          const content = await this.documentsService.readContent(ctxDoc.id)
          if (content) {
            lines.push(`\n## Active deal context`)
            lines.push(content.slice(0, 2000))
          }
        }
      } catch (err) {
        this.logger.warn(
          `Could not load deal context for ${activeDealId}: ${(err as Error).message}`,
        )
      }
    }

    // Tell Aria how to interact with CRM data via the internal API
    if (this.internalSecret) {
      lines.push(`\n## CRM data access`)
      lines.push(
        `Use the api_caller tool to look up or modify CRM data. All requests require:`,
      )
      lines.push(`- Base URL: ${this.internalApiBase}`)
      lines.push(`- Header: X-Internal-Secret: ${this.internalSecret}`)
      lines.push(`- Workspace filter: workspaceId=${dto.workspaceId}`)
      lines.push(`\nKey endpoints:`)
      lines.push(`- GET /deals?workspaceId=${dto.workspaceId}&limit=20 — list recent deals`)
      lines.push(`- GET /deals/{dealId} — deal details`)
      lines.push(
        `- GET /companies/search?q={query}&workspaceId=${dto.workspaceId} — search companies`,
      )
      lines.push(`- GET /activities?dealId={dealId}&limit=20 — deal activity log`)
      lines.push(
        `- PATCH /deals/{dealId} — update deal (body: { stage?, value?, probability?, closeDate? })`,
      )
    }

    return lines.join('\n')
  }

  private async pollForReply(ariaSessionId: string, startSeq: number): Promise<string> {
    const timeoutMs = 120_000
    const pollIntervalMs = 500
    const start = Date.now()
    let lastSeq = startSeq
    const parts: string[] = []

    while (Date.now() - start < timeoutMs) {
      let entries: Array<{ seq: number; type: string; payload: Record<string, unknown> }> = []

      try {
        const resp = await fetch(
          `${this.gatewayUrl}/v1/chat/history?session_id=${encodeURIComponent(ariaSessionId)}&after_seq=${lastSeq}`,
          { headers: { Authorization: `Bearer ${this.apiToken}` } },
        )
        if (resp.ok) {
          // Gateway returns { session_id: string, entries: [...] } — not a raw array
          const body = (await resp.json()) as {
            session_id?: string
            entries?: typeof entries
          }
          entries = Array.isArray(body.entries) ? body.entries : []
        }
      } catch (err) {
        this.logger.warn(`History poll failed: ${(err as Error).message}`)
      }

      for (const entry of entries) {
        if (entry.seq > lastSeq) lastSeq = entry.seq

        if (entry.type === 'text') {
          const text = entry.payload?.text as string | undefined
          if (text) parts.push(text)
        }

        if (entry.type === 'done' || entry.type === 'error') {
          return parts.join('')
        }
      }

      if (entries.length === 0) {
        await new Promise(r => setTimeout(r, pollIntervalMs))
      }
    }

    this.logger.warn(`Reply polling timed out for Aria session ${ariaSessionId}`)
    return parts.join('') || 'The request timed out. Please try again.'
  }
}
