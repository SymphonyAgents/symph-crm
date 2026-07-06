'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PipelineViewMode = 'kanban' | 'list' | 'heatmap'

type PipelineViewState = {
  viewMode: PipelineViewMode
  search: string
  assigneeFilterUserId: string | null
  initializedUserId: string | null
  setViewMode: (viewMode: PipelineViewMode) => void
  setSearch: (search: string) => void
  setAssigneeFilterUserId: (userId: string | null) => void
  defaultSearchForUser: (userId: string, search: string) => void
}

export const usePipelineViewStore = create<PipelineViewState>()(
  persist(
    set => ({
      viewMode: 'kanban',
      search: '',
      assigneeFilterUserId: null,
      initializedUserId: null,
      setViewMode: viewMode => set({ viewMode }),
      setSearch: search => set({ search }),
      setAssigneeFilterUserId: userId => set({ assigneeFilterUserId: userId }),
      defaultSearchForUser: (userId, search) => set({ search, initializedUserId: userId, assigneeFilterUserId: null }),
    }),
    {
      name: 'symph-crm-pipeline-view',
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState && typeof persistedState === 'object'
          ? persistedState as Partial<PipelineViewState>
          : {}
        return {
          viewMode: state.viewMode ?? 'kanban',
          search: state.search ?? '',
          assigneeFilterUserId: state.assigneeFilterUserId ?? null,
          initializedUserId: state.initializedUserId ?? null,
        }
      },
      partialize: state => ({
        viewMode: state.viewMode,
        search: state.search,
        assigneeFilterUserId: state.assigneeFilterUserId,
        initializedUserId: state.initializedUserId,
      }),
    },
  ),
)
