'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PipelineViewMode = 'kanban' | 'list' | 'heatmap'

type PipelineViewState = {
  viewMode: PipelineViewMode
  search: string
  assigneeFilterUserId: string | null
  setViewMode: (viewMode: PipelineViewMode) => void
  setSearch: (search: string) => void
  setAssigneeFilterUserId: (userId: string | null) => void
}

type LegacyPipelineViewState = Partial<PipelineViewState> & {
  initializedUserId?: string | null
}

export const usePipelineViewStore = create<PipelineViewState>()(
  persist(
    set => ({
      viewMode: 'kanban',
      search: '',
      assigneeFilterUserId: null,
      setViewMode: viewMode => set({ viewMode }),
      setSearch: search => set({ search }),
      setAssigneeFilterUserId: userId => set({ assigneeFilterUserId: userId }),
    }),
    {
      name: 'symph-crm-pipeline-view',
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState && typeof persistedState === 'object'
          ? persistedState as LegacyPipelineViewState
          : {}
        return {
          viewMode: state.viewMode ?? 'kanban',
          search: state.initializedUserId ? '' : state.search ?? '',
          assigneeFilterUserId: state.assigneeFilterUserId ?? null,
        }
      },
      partialize: state => ({
        viewMode: state.viewMode,
        search: state.search,
        assigneeFilterUserId: state.assigneeFilterUserId,
      }),
    },
  ),
)
