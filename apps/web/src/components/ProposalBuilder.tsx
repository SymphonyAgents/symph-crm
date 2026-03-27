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

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { EmptyState } from './EmptyState'
import { useUser } from '@/lib/hooks/use-user'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

// Dynamic import — Tiptap uses ProseMirror (browser DOM only, SSR breaks)
const ProposalEditor = dynamic(() => import('./ProposalEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-[13px] text-slate-400">
      Loading editor...
    </div>
  ),
})

type ApiDocument = {
  id: string
  dealId: string | null
  type: string
  title: string
  excerpt: string | null
  wordCount: number | null
  version: number | null
  parentId: string | null
  updatedAt: string
  createdAt: string
}

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
  const [title, setTitle] = useState('')
  const [dealId, setDealId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: deals = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ['deals'],
    queryFn: () => fetch(`${API}/deals`).then(r => r.json()),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId ?? '' },
        body: JSON.stringify({
          authorId: userId ?? '',
          dealId: dealId || null,
          type: 'proposal',
          title: title || 'Untitled Proposal',
          content: '',
          version: 1,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ApiDocument>
    },
    onSuccess: (doc) => { onCreated(doc); onClose() },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-slate-900">New Proposal</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">x</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-slate-600 mb-1">Title</label>
            <Input
              className="h-9 text-[13px]"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Jollibee HRIS Proposal"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-slate-600 mb-1">Deal (optional)</label>
            <Select
              value={dealId || '__none__'}
              onValueChange={v => setDealId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="w-full text-[13px] h-9">
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
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-[13px] rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] rounded-lg bg-slate-900 text-white font-medium disabled:opacity-40 hover:bg-slate-700"
            >
              {mutation.isPending ? 'Creating...' : 'Create'}
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
  const { data: allDocs = [], isLoading } = useQuery<ApiDocument[]>({
    queryKey: ['documents', 'proposals'],
    queryFn: () =>
      fetch(`${API}/documents?type=proposal`, { headers: { 'x-user-id': userId ?? '' } }).then(r => r.json()),
    enabled: !!userId,
  })

  const proposals = useMemo(
    () => allDocs.filter(d => d.type === 'proposal' && !d.parentId),
    [allDocs],
  )

  const versions = useMemo(
    () => allDocs.filter(d => d.type === 'proposal' && d.parentId === selectedId),
    [allDocs, selectedId],
  )

  // Fetch content for selected proposal
  const { data: contentData } = useQuery<{ content: string }>({
    queryKey: ['document-content', selectedId],
    queryFn: () =>
      fetch(`${API}/documents/${selectedId}/content`).then(r => r.json()),
    enabled: !!selectedId,
  })

  const selected = proposals.find(p => p.id === selectedId)

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar — proposal list */}
      <div className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="text-[13px] font-semibold text-slate-900">Proposals</span>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-[12px] px-2 py-1 bg-slate-900 text-white rounded-md hover:bg-slate-700 font-medium"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-lg px-4 py-3 bg-white border border-slate-100 animate-pulse">
                  <div className="h-3 w-3/4 bg-slate-100 rounded mb-1.5" />
                  <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
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
                  'w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors border-l-2',
                  selectedId === doc.id
                    ? 'border-slate-900 bg-white'
                    : 'border-transparent',
                )}
              >
                <p className="text-[12px] font-semibold text-slate-800 truncate">{doc.title}</p>
                {doc.excerpt && (
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{doc.excerpt}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(doc.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
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
            <div className="flex items-center px-6 py-3 border-b border-slate-200 bg-white gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 truncate">{selected?.title}</p>
                {selected?.dealId && (
                  <p className="text-[11px] text-slate-500">Linked to deal</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {versions.length > 0 && (
                  <button
                    onClick={() => setShowVersions(v => !v)}
                    className="text-[12px] px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                  >
                    {versions.length} version{versions.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>

            {/* Version history panel */}
            {showVersions && versions.length > 0 && (
              <div className="border-b border-slate-200 bg-amber-50 px-6 py-3">
                <p className="text-[12px] font-semibold text-amber-900 mb-2">Version History</p>
                <div className="flex gap-2 flex-wrap">
                  {versions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(v.id)}
                      className="text-[11px] px-2.5 py-1 border border-amber-300 rounded-md bg-white hover:bg-amber-50 text-amber-800"
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
                initialContent={contentData?.content ?? ''}
                onVersionSaved={() => {
                  qc.invalidateQueries({ queryKey: ['documents', 'proposals'] })
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
            qc.invalidateQueries({ queryKey: ['documents', 'proposals'] })
            setSelectedId(doc.id)
          }}
          userId={userId}
        />
      )}
    </div>
  )
}
