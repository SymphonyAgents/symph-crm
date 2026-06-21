import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query'
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
    onSuccess: (data, variables, context) => {
      toast.success('Lead updated')
      refreshLeadLists(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) })
      options?.onSuccess?.(data, variables, context, undefined as never)
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Lead update failed')
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
