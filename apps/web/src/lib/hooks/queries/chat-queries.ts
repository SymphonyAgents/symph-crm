import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type {
  ApiDeal,
  ApiDealDetail,
  ApiCompanyDetail,
  ApiUser,
  ApiProduct,
  ApiTier,
  Activity,
  ApiDocument,
  ApiBilling,
  PipelineSummary,
  FunnelResponse,
  AuditLogsResponse,
  ApiCalendarEvent,
  ApiTeamDemoEvent,
  CalendarStatus,
  InboxResponse,
  ApiNotification,
  DealNotesResponse,
  DealSummaryMeta,
  DealSummaryFull,
  ContactNotesResponse,
  NfsDealNote,
  ApiCatalogItem,
  ApiProposalListItem,
  ApiProposalSummary,
  ApiProposalHead,
  ApiProposalVersion,
  ApiProposalShareLink,
  ApiRecording,
  ApiMeetingDetail,
  ApiMeetingListItem,
  ApiPartnerGroup,
  ApiPartnerDealGroup,
} from '@/lib/types'

// ─── Chat Sessions ───────────────────────────────────────────────────────────

export type ApiChatSession = {
  id: string
  workspaceId: string
  userId: string
  title: string | null
  contextType: string | null
  contextId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function useGetChatSessions(
  userId: string | null | undefined,
  options?: Partial<UseQueryOptions<ApiChatSession[]>>,
) {
  return useQuery<ApiChatSession[]>({
    queryKey: queryKeys.chatSessions.byUser(userId ?? ''),
    queryFn: () => api.get<ApiChatSession[]>('/chat/sessions'),
    enabled: !!userId,
    refetchInterval: 30_000,
    ...options,
  })
}

export type ApiChatMessage = {
  id: string
  sessionId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  actionsTaken: unknown[]
  createdAt: string
}

export function useGetChatHistory(
  sessionId: string | null | undefined,
  options?: Partial<UseQueryOptions<ApiChatMessage[]>>,
) {
  return useQuery<ApiChatMessage[]>({
    queryKey: queryKeys.chatSessions.history(sessionId ?? ''),
    queryFn: () => api.get<ApiChatMessage[]>(`/chat/sessions/${sessionId}/history`),
    enabled: !!sessionId,
    ...options,
  })
}
