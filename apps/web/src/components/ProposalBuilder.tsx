'use client'

/**
 * ProposalBuilder — proposal list + Tiptap editor container.
 *
 * Architecture:
 *   ProposalBuilder (this file) — server-safe shell, handles list + selection
 *     └── ProposalEditor (dynamic import, ssr:false) — Tiptap, browser-only
 *
 * Data flow:
 *   List: GET /api/documents?dealId=&type=proposal (filter client-side by type)
 *   Create: POST /api/documents → new proposal document row
 *   Edit: ProposalEditor auto-saves to PUT /api/documents/:id every 2s
 *   Version: POST /api/documents with parentId = current documentId
 */

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { EmptyState } from './EmptyState'
import { useUser } from '@/lib/hooks/use-user'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApiDocument } from '@/lib/types'
import { useGetDeals, useGetDeal, useGetProposals, useGetDocumentContent } from '@/lib/hooks/queries'
import { useCreateDocument } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'

// Dynamic import — Tiptap uses ProseMirror (browser DOM only, SSR breaks)
const ProposalEditor = dynamic(() => import('./ProposalEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-ssm text-slate-400">
      Loading editor...
    </div>
  ),
})

// ─── New Proposal Modal ───────────────────────────────────────────────────────

function NewProposalModal({
  onClose,
  onCreated,
  userId,
}: {
  onClose: () => void
  onCreated: (doc: ApiDocument) => void
  userId: string | null
}) {
  useEscapeKey(useCallback(onClose, [onClose]))

  const [title, setTitle] = useState('')
  const [dealId, setDealId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: deals = [] } = useGetDeals({ dealType: 'agency' })

  const mutation = useCreateDocument({
    onSuccess: (doc) => { onCreated(doc); onClose() },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sbase font-semibold text-foreground">New Proposal</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-muted-foreground">x</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <Input
              className="h-9 text-ssm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Jollibee HRIS Proposal"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Deal (optional)</label>
            <Select
              value={dealId || '__none__'}
              onValueChange={v => setDealId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="w-full text-ssm h-9">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {deals.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-ssm rounded-lg border border-border text-muted-foreground hover:bg-surface-hover">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate({
                authorId: userId ?? '',
                dealId: dealId || null,
                type: 'proposal',
                title: title || 'Untitled Proposal',
                content: '',
                version: 1,
              })}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-ssm rounded-lg bg-slate-900 text-white font-medium disabled:opacity-40 hover:bg-slate-700"
            >
              <>{mutation.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Create</>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ProposalBuilder ─────────────────────────────────────────────────────

export function ProposalBuilder() {
  const { userId } = useUser()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  // All proposals — filter by type=proposal at the API level
  const { data: allDocs = [], isLoading } = useGetProposals({ enabled: !!userId })

  const proposals = useMemo(
    () => allDocs.filter(d => d.type === 'proposal' && !d.parentId),
    [allDocs],
  )

  const versions = useMemo(
    () => allDocs.filter(d => d.type === 'proposal' && d.parentId === selectedId),
    [allDocs, selectedId],
  )

  // Fetch content for selected proposal
  const { data: contentData } = useGetDocumentContent(selectedId)

  const selected = proposals.find(p => p.id === selectedId)
  const { data: selectedDeal } = useGetDeal(selected?.dealId ?? '', { enabled: !!selected?.dealId })

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar — proposal list */}
      <div className="w-64 shrink-0 border-r border-border bg-surface-alt flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-ssm font-semibold text-foreground">Proposals</span>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-xs px-2 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-700 font-medium"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-lg px-4 py-3 bg-card border border-border animate-pulse">
                  <div className="h-3 w-3/4 bg-secondary rounded mb-1.5" />
                  <div className="h-2.5 w-1/2 bg-secondary rounded" />
                </div>
              ))}
            </div>
          ) : proposals.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                title="No proposals yet"
                description="Create your first proposal"
                compact
              />
            </div>
          ) : (
            proposals.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors border-l-2',
                  selectedId === doc.id
                    ? 'border-primary bg-card'
                    : 'border-transparent',
                )}
              >
                <p className="text-xs font-semibold text-foreground truncate">{doc.title}</p>
                {doc.excerpt && (
                  <p className="text-xxs text-slate-500 mt-0.5 truncate">{doc.excerpt}</p>
                )}
                <p className="text-atom text-slate-400 mt-1">
                  {new Date(doc.updatedAt ?? '').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  {doc.wordCount ? ` · ${doc.wordCount} words` : ''}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              title="Select a proposal"
              description="Choose from the list or create a new one"
            />
          </div>
        ) : (
          <>
            {/* Editor header */}
            <div className="flex items-center px-6 py-3 border-b border-border bg-card gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{selected?.title}</p>
                {selected?.dealId && (
                  <p className="text-xxs text-slate-500">Linked to deal</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {versions.length > 0 && (
                  <button
                    onClick={() => setShowVersions(v => !v)}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-surface-hover text-muted-foreground"
                  >
                    {versions.length} version{versions.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>

            {/* Version history panel */}
            {showVersions && versions.length > 0 && (
              <div className="border-b border-border bg-amber-50 dark:bg-amber-950/30 px-6 py-3">
                <p className="text-xs font-semibold text-amber-900 mb-2">Version History</p>
                <div className="flex gap-2 flex-wrap">
                  {versions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      className="text-xxs px-2.5 py-1 border border-amber-300 dark:border-amber-700 rounded-lg bg-card hover:bg-amber-50 dark:bg-amber-950/30 text-amber-800"
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tiptap editor */}
            <div className="flex-1 overflow-hidden">
              <ProposalEditor
                key={selectedId}
                documentId={selectedId}
                dealId={selected?.dealId ?? ''}
                clientBrandColor={selectedDeal?.clientBrandColor ?? null}
                initialContent={contentData?.content ?? ''}
                onVersionSaved={() => {
                  qc.invalidateQueries({ queryKey: queryKeys.documents.proposals })
                  setShowVersions(true)
                }}
              />
            </div>
          </>
        )}
      </div>

      {showNewModal && (
        <NewProposalModal
          onClose={() => setShowNewModal(false)}
          onCreated={(doc) => {
            qc.invalidateQueries({ queryKey: queryKeys.documents.proposals })
            setSelectedId(doc.id)
          }}
          userId={userId}
        />
      )}
    </div>
  )
}
