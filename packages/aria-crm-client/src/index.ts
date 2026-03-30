/**
 * @symph-crm/aria-client
 *
 * Aria → Symph CRM internal API client.
 *
 * Usage:
 *   const crm = new CrmClient({
 *     baseUrl: 'https://symph-crm-api-t5wb3mrt7q-as.a.run.app',
 *     secret: process.env.CRM_INTERNAL_SECRET!,
 *   })
 *
 *   const pipeline = await crm.pipeline()
 *   const deal     = await crm.deals.get('deal-id')
 *   const companies = await crm.companies.search('Jollibee')
 *
 * The secret must match the INTERNAL_SECRET env var on the CRM API Cloud Run service.
 * Store it in GCP Secret Manager as `symph-crm-internal-secret`.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrmClientConfig {
  /** Base URL of the CRM API (no trailing slash). */
  baseUrl: string
  /** Value of INTERNAL_SECRET on the API Cloud Run service. */
  secret: string
}

export interface PipelineStageSummary {
  stage: string
  count: number
  totalValue: number
}

export interface PipelineSummary {
  stages: PipelineStageSummary[]
  totalDeals: number
  totalPipelineValue: number
  flaggedDeals: number
}

export interface Deal {
  id: string
  workspaceId: string
  title: string
  stage: string
  value: number | null
  companyId: string | null
  assignedTo: string | null
  servicesTags: string[] | null
  isFlagged: boolean
  flagReason: string | null
  lastActivityAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DealDetail {
  deal: Deal
  contextMarkdown: string | null
  documents: Document[]
  recentActivities: Activity[]
}

export interface Company {
  id: string
  workspaceId: string
  name: string
  domain: string | null
  industry: string | null
  website: string | null
  createdAt: string
  updatedAt: string
}

export interface CompanyDetail {
  company: Company
  deals: Deal[]
  contacts: Contact[]
  documents: Document[]
}

export interface Contact {
  id: string
  companyId: string | null
  name: string
  email: string | null
  phone: string | null
  role: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  dealId: string | null
  companyId: string | null
  type: string
  title: string
  storagePath: string
  excerpt: string | null
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  dealId: string | null
  companyId: string | null
  type: string
  description: string
  performedBy: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface UpdateDealInput {
  stage?: string
  value?: number
  title?: string
  notes?: string
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class CrmClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  readonly deals: DealsClient
  readonly companies: CompaniesClient
  readonly contacts: ContactsClient

  constructor(config: CrmClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.headers = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': config.secret,
    }

    this.deals = new DealsClient(this)
    this.companies = new CompaniesClient(this)
    this.contacts = new ContactsClient(this)
  }

  /** Verify connectivity. Throws if the secret is wrong or the API is down. */
  async ping(): Promise<{ ok: boolean; service: string; ts: string }> {
    return this.get('/api/internal/ping')
  }

  /** Pipeline summary grouped by stage. */
  async pipeline(): Promise<PipelineSummary> {
    return this.get('/api/internal/pipeline')
  }

  // ─── Internal fetch helpers ────────────────────────────────────────────────

  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v)
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers })
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText)
      throw new CrmApiError(res.status, body, path)
    }
    return res.json() as Promise<T>
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new CrmApiError(res.status, text, path)
    }
    return res.json() as Promise<T>
  }
}

// ─── Sub-clients ──────────────────────────────────────────────────────────────

export class DealsClient {
  constructor(private readonly crm: CrmClient) {}

  /** List deals with optional filters. */
  list(params?: {
    search?: string
    stage?: string
    companyId?: string
    limit?: number
  }): Promise<Deal[]> {
    return this.crm.get('/api/internal/deals', {
      search: params?.search,
      stage: params?.stage,
      companyId: params?.companyId,
      limit: params?.limit?.toString(),
    })
  }

  /** Get a deal with context.md, recent activities, and documents. */
  get(id: string): Promise<DealDetail> {
    return this.crm.get(`/api/internal/deals/${encodeURIComponent(id)}`)
  }

  /** Update deal fields. Only provided fields are changed. */
  update(id: string, data: UpdateDealInput): Promise<{ ok: boolean; deal: Deal }> {
    return this.crm.patch(`/api/internal/deals/${encodeURIComponent(id)}`, data)
  }
}

export class CompaniesClient {
  constructor(private readonly crm: CrmClient) {}

  /** List all companies or fuzzy-search by name/domain. */
  list(search?: string): Promise<Company[]> {
    return this.crm.get('/api/internal/companies', { search })
  }

  /** Alias for list(search) — more semantic for Aria tool calls. */
  search(query: string): Promise<Company[]> {
    return this.list(query)
  }

  /** Get a company with all deals, contacts, and documents. */
  get(id: string): Promise<CompanyDetail> {
    return this.crm.get(`/api/internal/companies/${encodeURIComponent(id)}`)
  }
}

export class ContactsClient {
  constructor(private readonly crm: CrmClient) {}

  /** List contacts with optional filters. */
  list(params?: { search?: string; companyId?: string }): Promise<Contact[]> {
    return this.crm.get('/api/internal/contacts', {
      search: params?.search,
      companyId: params?.companyId,
    })
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class CrmApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`CRM API error ${status} on ${path}: ${body}`)
    this.name = 'CrmApiError'
  }
}
