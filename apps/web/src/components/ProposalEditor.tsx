'use client'

/**
 * ProposalEditor — Tiptap rich text editor for proposals.
 *
 * MUST be imported via dynamic() with ssr:false — Tiptap uses ProseMirror
 * which depends on browser DOM APIs unavailable at SSR time.
 *
 * Auto-saves via debounce (2s). Saves HTML content to API → Supabase Storage.
 * AI reads: plain text extracted from editor content.
 * AI writes: setContent(html) where html comes from Claude markdown output.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { cn } from '@/lib/utils'
import { useUser } from '@/lib/hooks/use-user'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type Props = {
  documentId: string
  dealId: string
  initialContent?: string   // HTML from previous save
  onVersionSaved?: () => void
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'px-2 py-1 rounded text-[12px] font-medium transition-colors',
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function ProposalEditor({ documentId, dealId, initialContent, onVersionSaved }: Props) {
  const { userId } = useUser()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [wordCount, setWordCount] = useState(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
      Placeholder.configure({ placeholder: 'Start writing your proposal...' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
      triggerAutoSave(editor.getHTML())
    },
  })

  // ── Auto-save (debounce 2s) ─────────────────────────────────────────────

  const triggerAutoSave = useCallback((html: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      if (isSavingRef.current) return
      isSavingRef.current = true
      try {
        const excerpt = html.replace(/<[^>]+>/g, '').slice(0, 500)
        const res = await fetch(`${API}/documents/${documentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId ?? '' },
          body: JSON.stringify({
            content: html,
            excerpt,
            wordCount,
            updatedAt: new Date().toISOString(),
          }),
        })
        setSaveStatus(res.ok ? 'saved' : 'error')
      } catch {
        setSaveStatus('error')
      } finally {
        isSavingRef.current = false
      }
    }, 2000)
  }, [documentId, wordCount, userId])

  // ── Save Version ────────────────────────────────────────────────────────

  const saveVersion = useCallback(async () => {
    if (!editor) return
    const html = editor.getHTML()

    const res = await fetch(`${API}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId ?? '' },
      body: JSON.stringify({
        dealId,
        authorId: userId ?? '',
        type: 'proposal',
        title: `Version — ${new Date().toLocaleString('en-PH')}`,
        content: html,
        parentId: documentId,
        excerpt: html.replace(/<[^>]+>/g, '').slice(0, 500),
      }),
    })

    if (res.ok) onVersionSaved?.()
  }, [editor, dealId, documentId, onVersionSaved, userId])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  if (!editor) return null

  const { state } = editor

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-slate-200 bg-slate-50 flex-wrap">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• List</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. List</ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table"
        >
          Table
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive('link')}
          title="Link"
        >
          Link
        </ToolbarBtn>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↩</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↪</ToolbarBtn>

        {/* Right side: status + actions */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-slate-400">{wordCount} words</span>
          <span className={cn('text-[11px]',
            saveStatus === 'saved' && 'text-green-600',
            saveStatus === 'saving' && 'text-slate-500',
            saveStatus === 'error' && 'text-red-500',
            saveStatus === 'idle' && 'text-slate-400',
          )}>
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Save failed'}
            {saveStatus === 'idle' && 'No changes'}
          </span>
          <button
            onClick={saveVersion}
            className="px-3 py-1 text-[12px] border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 font-medium"
          >
            Save Version
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
