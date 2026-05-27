import { Injectable, Inject, OnModuleInit, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { and, eq, desc, isNull, sql } from 'drizzle-orm'
import { proposals, proposalVersions, proposalShareLinks } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { StorageService } from '../storage/storage.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import type { CreateProposalDto } from './dto/create-proposal.dto'
import type { SaveVersionDto } from './dto/save-version.dto'
import type { UpdateProposalDto } from './dto/update-proposal.dto'
import type { CreateShareLinkDto } from './dto/create-share-link.dto'
import { validateProposalHtmlDocument } from './proposal-html-validation'

export function normalizeProposalTitleForDuplicateCheck(title: string) {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(new RegExp('[\\u2010-\\u2015]', 'g'), '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * ProposalsService — versioned proposal documents stored in Postgres.
 *
 * Architecture (see docs/PROPOSAL-PDF-STRATEGY.md for the deferred PDF plan):
 *
 *   proposals             — chain identity (one row per proposal)
 *   proposal_versions     — one row per saved revision; HTML inline as text
 *   proposal_share_links  — public read-only tokens, pinned to a specific version
 *
 * HTML lives in `proposal_versions.html` (TOAST-compressed). Per-version cap
 * is 5MB at the API layer — heavy embeds (images, video) belong in Supabase
 * Storage and referenced by URL, not base64-stuffed into the HTML.
 *
 * List endpoints NEVER select the html column (column-narrow projections).
 * Detail / editor / share-link endpoints select html for one row at a time.
 */
@Injectable()
export class ProposalsService implements OnModuleInit {
  private readonly logger = new Logger(ProposalsService.name)

  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
  ) {}

  // ── Boot migration ────────────────────────────────────────────────────────

  async onModuleInit() {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS proposals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID REFERENCES workspaces(id),
          deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          current_version INTEGER NOT NULL DEFAULT 1,
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        )
      `)

      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS proposal_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          html TEXT NOT NULL,
          change_note TEXT,
          excerpt TEXT,
          word_count INTEGER DEFAULT 0,
          pdf_storage_path TEXT,
          author_id TEXT NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await this.db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS proposal_versions_proposal_id_version_key ON proposal_versions(proposal_id, version)`)
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal ON proposal_versions(proposal_id)`)

      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS proposal_share_links (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_version_id UUID NOT NULL REFERENCES proposal_versions(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ,
          view_count INTEGER NOT NULL DEFAULT 0,
          last_viewed_at TIMESTAMPTZ,
          created_by TEXT REFERENCES users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at TIMESTAMPTZ
        )
      `)
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_share_links_version ON proposal_share_links(proposal_version_id) WHERE revoked_at IS NULL`)
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_share_links_token ON proposal_share_links(token) WHERE revoked_at IS NULL`)

      // Indexes for the most common reads
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_proposals_deal ON proposals(deal_id) WHERE deleted_at IS NULL`)
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_proposals_updated ON proposals(updated_at DESC) WHERE deleted_at IS NULL`)

      this.logger.log('Proposals schema ready (proposals, proposal_versions, proposal_share_links)')
    } catch (err: any) {
      this.logger.error(`Boot migration failed: ${err.message}`)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private validateHtml(html: string) {
    validateProposalHtmlDocument(html)
  }

  private newToken(): string {
    return randomBytes(24).toString('base64url') // 32 chars, ~190 bits entropy
  }

  private duplicateAdvisoryLockKey(dealId: string, normalizedTitle: string) {
    return `proposal:${dealId}:${normalizedTitle}`
  }

  // ── List / read ───────────────────────────────────────────────────────────

  /**
   * Proposals for a deal — one entry per chain. Metadata only; no html.
   * Latest version's metadata (changeNote, authorId, createdAt) is joined in.
   */
  /**
   * Workspace-wide list — used by the /proposals index page. Joins to deals
   * + companies so the index can render brand/deal context without a second
   * round-trip per row. Never selects html (column-narrow projection).
   */
  async listAll(workspaceId?: string) {
    const rows = await this.db.execute<any>(sql`
      SELECT
        p.id, p.title, p.deal_id, p.is_pinned, p.current_version,
        p.created_by, p.created_at, p.updated_at,
        d.title       AS deal_title,
        c.id          AS brand_id,
        c.name        AS brand_name,
        v.id          AS current_version_id,
        v.change_note AS current_change_note,
        v.excerpt     AS current_excerpt,
        v.word_count  AS current_word_count,
        v.author_id   AS current_author_id,
        v.created_at  AS current_version_created_at
      FROM proposals p
      LEFT JOIN deals d ON d.id = p.deal_id AND d.deleted_at IS NULL
      LEFT JOIN companies c ON c.id = d.company_id
      LEFT JOIN proposal_versions v
        ON v.proposal_id = p.id AND v.version = p.current_version
      WHERE p.deleted_at IS NULL
        ${workspaceId ? sql`AND p.workspace_id = ${workspaceId}` : sql``}
      ORDER BY p.updated_at DESC
    `)
    const list = (rows as any).rows ?? rows
    return (list as any[]).map(r => ({
      ...this.toListItem(r),
      dealTitle: r.deal_title ?? null,
      brandId: r.brand_id ?? null,
      brandName: r.brand_name ?? null,
    }))
  }

  async listByDeal(dealId: string) {
    const rows = await this.db.execute<any>(sql`
      SELECT
        p.id, p.title, p.deal_id, p.is_pinned, p.current_version,
        p.created_by, p.created_at, p.updated_at,
        v.id          AS current_version_id,
        v.change_note AS current_change_note,
        v.excerpt     AS current_excerpt,
        v.word_count  AS current_word_count,
        v.author_id   AS current_author_id,
        v.created_at  AS current_version_created_at
      FROM proposals p
      LEFT JOIN proposal_versions v
        ON v.proposal_id = p.id AND v.version = p.current_version
      WHERE p.deal_id = ${dealId}
        AND p.deleted_at IS NULL
      ORDER BY p.updated_at DESC
    `)
    const list = (rows as any).rows ?? rows
    return (list as any[]).map(this.toListItem)
  }

  /** Head + the current version's HTML (for the editor open-on-load). */
  async getHead(proposalId: string) {
    const [p] = await this.db.select().from(proposals)
      .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
    if (!p) throw new NotFoundException(`Proposal ${proposalId} not found`)

    const [v] = await this.db.select().from(proposalVersions)
      .where(and(eq(proposalVersions.proposalId, proposalId), eq(proposalVersions.version, p.currentVersion)))
    if (!v) throw new NotFoundException(`Proposal ${proposalId} has no current version`)

    return {
      id: p.id,
      title: p.title,
      dealId: p.dealId,
      isPinned: p.isPinned,
      currentVersion: p.currentVersion,
      versionCount: p.currentVersion, // monotonic; we never delete versions individually
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      version: this.toVersionItem(v, true),
    }
  }

  /** Metadata-only version list (no html). */
  async listVersions(proposalId: string) {
    return this.db
      .select({
        id: proposalVersions.id,
        version: proposalVersions.version,
        changeNote: proposalVersions.changeNote,
        excerpt: proposalVersions.excerpt,
        wordCount: proposalVersions.wordCount,
        authorId: proposalVersions.authorId,
        createdAt: proposalVersions.createdAt,
      })
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposalId))
      .orderBy(desc(proposalVersions.version))
  }

  /** One specific version with html. */
  async getVersion(proposalId: string, versionId: string) {
    const [v] = await this.db.select().from(proposalVersions)
      .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.proposalId, proposalId)))
    if (!v) throw new NotFoundException(`Version ${versionId} not found`)
    return this.toVersionItem(v, true)
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async create(dealId: string, dto: CreateProposalDto, authorId: string, workspaceId?: string) {
    if (!dto.title?.trim()) throw new BadRequestException('title is required')
    this.validateHtml(dto.html)
    const title = dto.title.trim()
    const normalizedTitle = normalizeProposalTitleForDuplicateCheck(title)
    const { excerpt, wordCount } = StorageService.extractHtmlExcerpt(dto.html)

    const created = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${this.duplicateAdvisoryLockKey(dealId, normalizedTitle)}, 0))`)

      const activeRows = await tx
        .select({ id: proposals.id, title: proposals.title, currentVersion: proposals.currentVersion })
        .from(proposals)
        .where(and(eq(proposals.dealId, dealId), isNull(proposals.deletedAt)))

      const duplicate = activeRows.find(row => normalizeProposalTitleForDuplicateCheck(row.title) === normalizedTitle)
      if (duplicate) {
        throw new ConflictException({
          message: 'Proposal already exists for this deal and title. Save a new version on the existing proposal instead.',
          existingProposalId: duplicate.id,
          existingProposalTitle: duplicate.title,
          existingCurrentVersion: duplicate.currentVersion,
        })
      }

      const [p] = await tx.insert(proposals).values({
        workspaceId: workspaceId ?? null,
        dealId,
        title,
        currentVersion: 1,
        createdBy: authorId,
      }).returning()

      const [v] = await tx.insert(proposalVersions).values({
        proposalId: p.id,
        version: 1,
        html: dto.html,
        changeNote: dto.changeNote?.trim() || 'Initial draft',
        excerpt,
        wordCount,
        authorId,
      }).returning()

      return { p, v }
    })

    this.auditLogs.log({
      action: 'create',
      auditType: 'proposal_created',
      entityType: 'proposal',
      entityId: created.p.id,
      performedBy: authorId,
      details: { title: created.p.title, dealId, version: 1 },
    }).catch(() => {})

    return {
      id: created.p.id,
      title: created.p.title,
      dealId: created.p.dealId,
      isPinned: created.p.isPinned,
      currentVersion: 1,
      version: this.toVersionItem(created.v, true),
    }
  }

  async saveVersion(proposalId: string, dto: SaveVersionDto, authorId: string) {
    this.validateHtml(dto.html)
    const { excerpt, wordCount } = StorageService.extractHtmlExcerpt(dto.html)

    const result = await this.db.transaction(async (tx) => {
      // Lock the proposal row so two concurrent saves serialize cleanly.
      const [p] = await tx
        .select()
        .from(proposals)
        .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
        .for('update')
      if (!p) throw new NotFoundException(`Proposal ${proposalId} not found`)

      const nextVersion = p.currentVersion + 1
      const [v] = await tx.insert(proposalVersions).values({
        proposalId,
        version: nextVersion,
        html: dto.html,
        changeNote: dto.changeNote?.trim() || `Revision ${nextVersion}`,
        excerpt,
        wordCount,
        authorId,
      }).returning()

      await tx.update(proposals)
        .set({ currentVersion: nextVersion, updatedAt: new Date() })
        .where(eq(proposals.id, proposalId))

      return { p, v }
    })

    this.auditLogs.log({
      action: 'update',
      auditType: 'proposal_updated',
      entityType: 'proposal',
      entityId: proposalId,
      performedBy: authorId,
      details: { title: result.p.title, version: result.v.version, changeNote: result.v.changeNote },
    }).catch(() => {})

    return this.toVersionItem(result.v, true)
  }

  async updateMeta(proposalId: string, dto: UpdateProposalDto, performedBy?: string) {
    const set: Partial<typeof proposals.$inferInsert> = { updatedAt: new Date() }
    if (dto.title !== undefined) set.title = dto.title.trim()
    if (dto.isPinned !== undefined) set.isPinned = dto.isPinned

    const [p] = await this.db.update(proposals).set(set)
      .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
      .returning()
    if (!p) throw new NotFoundException(`Proposal ${proposalId} not found`)

    this.auditLogs.log({
      action: 'update',
      auditType: 'proposal_updated',
      entityType: 'proposal',
      entityId: proposalId,
      performedBy,
      details: { fields: Object.keys(dto) },
    }).catch(() => {})

    return this.getHead(proposalId)
  }

  async softDelete(proposalId: string, performedBy?: string) {
    const [p] = await this.db.update(proposals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
      .returning()
    if (!p) throw new NotFoundException(`Proposal ${proposalId} not found`)

    this.auditLogs.log({
      action: 'delete',
      auditType: 'proposal_deleted',
      entityType: 'proposal',
      entityId: proposalId,
      performedBy,
      details: { title: p.title, versionCount: p.currentVersion },
    }).catch(() => {})
  }

  // ── Share links ───────────────────────────────────────────────────────────

  async createShareLink(proposalId: string, dto: CreateShareLinkDto, createdBy: string) {
    // Resolve target version: explicit versionId, else current.
    let targetVersionId = dto.versionId
    if (!targetVersionId) {
      const [p] = await this.db.select({ currentVersion: proposals.currentVersion })
        .from(proposals)
        .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
      if (!p) throw new NotFoundException(`Proposal ${proposalId} not found`)
      const [v] = await this.db.select({ id: proposalVersions.id })
        .from(proposalVersions)
        .where(and(eq(proposalVersions.proposalId, proposalId), eq(proposalVersions.version, p.currentVersion)))
      if (!v) throw new NotFoundException(`Proposal ${proposalId} has no current version`)
      targetVersionId = v.id
    } else {
      const [v] = await this.db.select({ id: proposalVersions.id })
        .from(proposalVersions)
        .where(and(eq(proposalVersions.id, targetVersionId), eq(proposalVersions.proposalId, proposalId)))
      if (!v) throw new NotFoundException(`Version ${targetVersionId} not found in proposal ${proposalId}`)
    }

    const [link] = await this.db.insert(proposalShareLinks).values({
      proposalVersionId: targetVersionId,
      token: this.newToken(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy,
    }).returning()

    this.auditLogs.log({
      action: 'create',
      auditType: 'proposal_share_link_created',
      entityType: 'proposal',
      entityId: proposalId,
      performedBy: createdBy,
      details: { proposalVersionId: targetVersionId, expiresAt: link.expiresAt },
    }).catch(() => {})

    return link
  }

  async listShareLinks(proposalId: string) {
    return this.db
      .select({
        id: proposalShareLinks.id,
        token: proposalShareLinks.token,
        proposalVersionId: proposalShareLinks.proposalVersionId,
        version: proposalVersions.version,
        expiresAt: proposalShareLinks.expiresAt,
        viewCount: proposalShareLinks.viewCount,
        lastViewedAt: proposalShareLinks.lastViewedAt,
        createdBy: proposalShareLinks.createdBy,
        createdAt: proposalShareLinks.createdAt,
      })
      .from(proposalShareLinks)
      .innerJoin(proposalVersions, eq(proposalVersions.id, proposalShareLinks.proposalVersionId))
      .where(and(eq(proposalVersions.proposalId, proposalId), isNull(proposalShareLinks.revokedAt)))
      .orderBy(desc(proposalShareLinks.createdAt))
  }

  async revokeShareLink(linkId: string, performedBy?: string) {
    const [revoked] = await this.db.update(proposalShareLinks)
      .set({ revokedAt: new Date() })
      .where(eq(proposalShareLinks.id, linkId))
      .returning()
    if (!revoked) throw new NotFoundException(`Share link ${linkId} not found`)

    // Resolve proposalId for audit
    const [v] = await this.db.select({ proposalId: proposalVersions.proposalId })
      .from(proposalVersions)
      .where(eq(proposalVersions.id, revoked.proposalVersionId))

    this.auditLogs.log({
      action: 'delete',
      auditType: 'proposal_share_link_revoked',
      entityType: 'proposal',
      entityId: v?.proposalId,
      performedBy,
    }).catch(() => {})

    return { id: revoked.id, revokedAt: revoked.revokedAt }
  }

  // ── Public render ─────────────────────────────────────────────────────────

  /**
   * Resolve a public share token. Returns the version's HTML with <script>
   * tags + on* event handlers stripped. Bumps view metrics on success.
   * Throws NotFound on bad/expired/revoked tokens — never reveal which.
   */
  async resolvePublicToken(token: string) {
    const [link] = await this.db.select().from(proposalShareLinks).where(eq(proposalShareLinks.token, token))
    if (!link) throw new NotFoundException('Link not found')
    if (link.revokedAt) throw new NotFoundException('Link not found')
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) throw new NotFoundException('Link not found')

    const [row] = await this.db
      .select({
        version: proposalVersions.version,
        html: proposalVersions.html,
        proposalId: proposalVersions.proposalId,
        proposalTitle: proposals.title,
        deletedAt: proposals.deletedAt,
      })
      .from(proposalVersions)
      .innerJoin(proposals, eq(proposals.id, proposalVersions.proposalId))
      .where(eq(proposalVersions.id, link.proposalVersionId))
    if (!row || row.deletedAt) throw new NotFoundException('Link not found')

    // Best-effort view bump (non-blocking)
    this.db.update(proposalShareLinks)
      .set({
        viewCount: sql`${proposalShareLinks.viewCount} + 1`,
        lastViewedAt: new Date(),
      })
      .where(eq(proposalShareLinks.id, link.id))
      .catch(() => {})

    return {
      title: row.proposalTitle,
      version: row.version,
      html: stripScripts(row.html),
    }
  }

  // ── Shape helpers ─────────────────────────────────────────────────────────

  private toListItem = (r: any) => ({
    id: r.id,
    title: r.title,
    dealId: r.deal_id ?? r.dealId,
    isPinned: r.is_pinned ?? r.isPinned ?? false,
    currentVersion: r.current_version ?? r.currentVersion,
    currentVersionId: r.current_version_id,
    changeNote: r.current_change_note,
    excerpt: r.current_excerpt,
    wordCount: r.current_word_count,
    authorId: r.current_author_id,
    createdBy: r.created_by ?? r.createdBy,
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  })

  private toVersionItem(v: typeof proposalVersions.$inferSelect, includeHtml = false) {
    return {
      id: v.id,
      version: v.version,
      changeNote: v.changeNote,
      excerpt: v.excerpt,
      wordCount: v.wordCount,
      authorId: v.authorId,
      createdAt: v.createdAt,
      ...(includeHtml ? { html: v.html } : {}),
    }
  }
}

/** Strip <script> tags + on* event handler attributes from HTML. */
function stripScripts(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
}
