import { Injectable, Inject, NotFoundException, BadRequestException, PayloadTooLargeException } from '@nestjs/common'
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
const HTML_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

@Injectable()
export class ProposalsService {
  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private validateHtml(html: string) {
    if (!html?.trim()) throw new BadRequestException('html is required')
    const bytes = Buffer.byteLength(html, 'utf8')
    if (bytes > HTML_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Proposal HTML is ${(bytes / 1024 / 1024).toFixed(2)}MB; cap is ${HTML_MAX_BYTES / 1024 / 1024}MB. ` +
        `Move embedded images/videos to Supabase Storage and reference by URL.`,
      )
    }
  }

  private newToken(): string {
    return randomBytes(24).toString('base64url') // 32 chars, ~190 bits entropy
  }

  private titleBase(title: string): string {
    return title
      .trim()
      .replace(/\.html?$/i, '')
      .replace(/\s+v\d+$/i, '')
      .replace(/-\d{3}$/i, '')
      .trim()
  }

  private titleForVersion(baseTitle: string, version: number): string {
    return `${this.titleBase(baseTitle)}-${String(version).padStart(3, '0')}`
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
      LEFT JOIN deals d ON d.id = p.deal_id
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
    const titleBase = this.titleBase(dto.title)
    if (!titleBase) throw new BadRequestException('title is required')
    const { excerpt, wordCount } = StorageService.extractHtmlExcerpt(dto.html)

    const created = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(proposals)
        .where(and(
          eq(proposals.dealId, dealId),
          isNull(proposals.deletedAt),
          sql`
            btrim(
              regexp_replace(
                regexp_replace(
                  regexp_replace(${proposals.title}, '\\.html?$', '', 'i'),
                  '\\s+v[0-9]+$',
                  '',
                  'i'
                ),
                '-[0-9]{3}$',
                '',
                'i'
              )
            ) = ${titleBase}
          `,
        ))
        .orderBy(desc(proposals.currentVersion), desc(proposals.updatedAt))
        .limit(1)
        .for('update')

      if (existing) {
        const nextVersion = existing.currentVersion + 1
        const [v] = await tx.insert(proposalVersions).values({
          proposalId: existing.id,
          version: nextVersion,
          html: dto.html,
          changeNote: dto.changeNote?.trim() || `Revision ${nextVersion}`,
          excerpt,
          wordCount,
          authorId,
        }).returning()

        const [p] = await tx.update(proposals)
          .set({
            title: this.titleForVersion(existing.title, nextVersion),
            currentVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(eq(proposals.id, existing.id))
          .returning()

        return { p, v, createdNewChain: false }
      }

      const [p] = await tx.insert(proposals).values({
        workspaceId: workspaceId ?? null,
        dealId,
        title: this.titleForVersion(titleBase, 1),
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

      return { p, v, createdNewChain: true }
    })

    this.auditLogs.log({
      action: created.createdNewChain ? 'create' : 'update',
      auditType: created.createdNewChain ? 'proposal_created' : 'proposal_updated',
      entityType: 'proposal',
      entityId: created.p.id,
      performedBy: authorId,
      details: {
        title: created.p.title,
        dealId,
        version: created.v.version,
        createdNewChain: created.createdNewChain,
      },
    }).catch(() => {})

    return {
      id: created.p.id,
      title: created.p.title,
      dealId: created.p.dealId,
      isPinned: created.p.isPinned,
      currentVersion: created.p.currentVersion,
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
        .set({
          title: this.titleForVersion(p.title, nextVersion),
          currentVersion: nextVersion,
          updatedAt: new Date(),
        })
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
    if (dto.title !== undefined) {
      const [current] = await this.db.select({ currentVersion: proposals.currentVersion })
        .from(proposals)
        .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
      if (!current) throw new NotFoundException(`Proposal ${proposalId} not found`)
      const titleBase = this.titleBase(dto.title)
      if (!titleBase) throw new BadRequestException('title is required')
      set.title = this.titleForVersion(titleBase, current.currentVersion)
    }
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
