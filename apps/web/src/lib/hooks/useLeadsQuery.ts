import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiLead, ApiLeadConversion, ApiLeadsListResponse, ConvertLeadInput, CreateLeadInput, LeadConversionResult, LeadsListParams, UpdateLeadInput } from '@/lib/types'

export function useLeadsList(
  params: LeadsListParams = {},
  options?: Partial<UseQueryOptions<ApiLeadsListResponse>>,
) {
  return useQuery<ApiLeadsListResponse>({
    queryKey: queryKeys.leads.filtered(params),
    queryFn: () => api.leads.list(params),
    ...options,
  })
}

export function useInfiniteLeadsList(params: LeadsListParams = {}, pageSize = 20) {
  const queryParams = { ...params, limit: pageSize, offset: undefined }
  return useInfiniteQuery<ApiLeadsListResponse>({
    queryKey: queryKeys.leads.infinite(queryParams),
    queryFn: ({ pageParam }) => api.leads.list({ ...params, limit: pageSize, offset: Number(pageParam) }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < lastPage.count ? loaded : undefined
    },
  })
}

export function useLeadDetail(
  id: string | undefined,
  options?: Partial<UseQueryOptions<ApiLead>>,
) {
  return useQuery<ApiLead>({
    queryKey: queryKeys.leads.detail(id ?? ''),
    queryFn: () => api.leads.detail(id ?? ''),
    enabled: !!id,
    ...options,
  })
}

export function useLeadConversions(
  id: string | undefined,
  options?: Partial<UseQueryOptions<ApiLeadConversion[]>>,
) {
  return useQuery<ApiLeadConversion[]>({
    queryKey: queryKeys.leads.conversions(id ?? ''),
    queryFn: () => api.leads.conversions(id ?? ''),
    enabled: !!id,
    ...options,
  })
}

function refreshLeadLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
}

function isInfiniteLeadsData(data: ApiLeadsListResponse | InfiniteData<ApiLeadsListResponse>): data is InfiniteData<ApiLeadsListResponse> {
  return 'pages' in data
}

function patchLeadItem(lead: ApiLead, id: string, patch: UpdateLeadInput) {
  if (lead.id !== id) return lead
  return { ...lead, ...patch }
}

function patchLeadListData(data: ApiLeadsListResponse, id: string, patch: UpdateLeadInput): ApiLeadsListResponse {
  return {
    ...data,
    items: data.items.map(lead => patchLeadItem(lead, id, patch)),
  }
}

function patchLeadQueries(queryClient: ReturnType<typeof useQueryClient>, id: string, patch: UpdateLeadInput) {
  queryClient.setQueryData<ApiLead>(queryKeys.leads.detail(id), previous => (previous ? patchLeadItem(previous, id, patch) : previous))
  queryClient.setQueriesData<ApiLeadsListResponse | InfiniteData<ApiLeadsListResponse>>(
    {
      predicate: query => {
        const key = query.queryKey
        return key[0] === 'leads' && (key[1] === 'infinite' || typeof key[1] === 'object')
      },
    },
    previous => {
      if (!previous) return previous
      if (isInfiniteLeadsData(previous)) {
        return {
          ...previous,
          pages: previous.pages.map(page => patchLeadListData(page, id, patch)),
        }
      }
      return patchLeadListData(previous, id, patch)
    },
  )
}

export function useCreateLead(
  options?: UseMutationOptions<ApiLead, Error, CreateLeadInput>,
) {
  const queryClient = useQueryClient()
  return useMutation<ApiLead, Error, CreateLeadInput>({
    mutationFn: (input) => api.leads.create(input),
    onSuccess: (data, variables, context) => {
      toast.success('Lead created')
      refreshLeadLists(queryClient)
      options?.onSuccess?.(data, variables, context, undefined as never)
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Lead creation failed')
      options?.onError?.(error, variables, context, undefined as never)
    },
  })
}

export function useUpdateLead(
  options?: UseMutationOptions<ApiLead, Error, { id: string; data: UpdateLeadInput }>,
) {
  const queryClient = useQueryClient()
  return useMutation<ApiLead, Error, { id: string; data: UpdateLeadInput }>({
    mutationFn: ({ id, data }) => api.leads.update(id, data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.all })
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.detail(variables.id) })
      patchLeadQueries(queryClient, variables.id, variables.data)
    },
    onSuccess: (data, variables, context) => {
      toast.success('Lead updated')
      patchLeadQueries(queryClient, variables.id, data)
      refreshLeadLists(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) })
      options?.onSuccess?.(data, variables, context, undefined as never)
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Lead update failed')
      refreshLeadLists(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) })
      options?.onError?.(error, variables, context, undefined as never)
    },
  })
}

export function useConvertLead(
  options?: UseMutationOptions<LeadConversionResult, Error, { id: string; data: ConvertLeadInput }>,
) {
  const queryClient = useQueryClient()
  return useMutation<LeadConversionResult, Error, { id: string; data: ConvertLeadInput }>({
    mutationFn: ({ id, data }) => api.leads.convert(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Lead converted to deal')
      refreshLeadLists(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
      options?.onSuccess?.(data, variables, context, undefined as never)
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Lead conversion failed')
      options?.onError?.(error, variables, context, undefined as never)
    },
  })
}

export function useDeleteLead(
  options?: UseMutationOptions<ApiLead, Error, string>,
) {
  const queryClient = useQueryClient()
  return useMutation<ApiLead, Error, string>({
    mutationFn: (id) => api.leads.remove(id),
    onSuccess: (data, variables, context) => {
      toast.success('Lead deleted')
      refreshLeadLists(queryClient)
      options?.onSuccess?.(data, variables, context, undefined as never)
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Lead deletion failed')
      options?.onError?.(error, variables, context, undefined as never)
    },
  })
}
