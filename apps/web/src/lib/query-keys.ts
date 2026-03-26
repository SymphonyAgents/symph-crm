/**
 * Centralized TanStack Query key factory.
 *
 * Rules:
 * - ALWAYS import from here — never hardcode string arrays in components.
 * - Key hierarchy: [entity] → [entity, id] → [entity, id, relation]
 * - Invalidating a parent key invalidates ALL child keys automatically.
 *   e.g. invalidate(queryKeys.companies.all) also invalidates .detail() and .deals()
 */

type DealsFilterParams = {
  stage?: string
  companyId?: string
  limit?: number
}

export const queryKeys = {
  companies: {
    all: ['companies'] as const,
    search: (q: string) => ['companies', 'search', q] as const,
    detail: (id: string) => ['companies', id] as const,
    deals: (id: string) => ['companies', id, 'deals'] as const,
    contacts: (id: string) => ['companies', id, 'contacts'] as const,
  },
  deals: {
    all: ['deals'] as const,
    filtered: (params: DealsFilterParams) => ['deals', params] as const,
    detail: (id: string) => ['deals', id] as const,
  },
  pipeline: {
    summary: ['pipeline', 'summary'] as const,
  },
  products: {
    all: ['products'] as const,
  },
  tiers: {
    all: ['tiers'] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    byCompany: (companyId: string) => ['contacts', 'company', companyId] as const,
  },
  activities: {
    byDeal: (dealId: string) => ['activities', 'deal', dealId] as const,
    byCompany: (companyId: string) => ['activities', 'company', companyId] as const,
  },
} as const
