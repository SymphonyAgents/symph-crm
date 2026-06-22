'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateContact } from '@/lib/hooks/mutations'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import type { ApiContact } from '@/lib/hooks/queries'

type Props = {
  contact: ApiContact
  onClose: () => void
}

// Extract role and notes from the combined title field ("role — notes")
function parseTitle(raw: string | null): { role: string; notes: string } {
  if (!raw) return { role: '', notes: '' }
  const parts = raw.split(' — ')
  if (parts.length >= 2) {
    return { role: parts[0].trim(), notes: parts.slice(1).join(' — ').trim() }
  }
  // Could be role-only or notes-only — try to match against known roles
  const ROLES = ['poc', 'stakeholder', 'champion', 'blocker', 'technical', 'executive']
  if (ROLES.includes(raw.toLowerCase())) return { role: raw.toLowerCase(), notes: '' }
  return { role: '', notes: raw }
}

export function EditContactModal({ contact, onClose }: Props) {
  useEscapeKey(useCallback(onClose, [onClose]))


  const { role: initialRole, notes: initialNotes } = parseTitle(contact.title)
  const [name, setName] = useState(contact.name)
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [role, setRole] = useState(initialRole)
  const [notes, setNotes] = useState(initialNotes)

  const updateContact = useUpdateContact({
    onSuccess: onClose,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const combinedTitle = [role, notes.trim()].filter(Boolean).join(' — ') || null

    updateContact.mutate({
      id: contact.id,
      companyId: contact.companyId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      title: combinedTitle,
    })
  }

  const canSubmit = !!name.trim()

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 animate-in fade-in-0 duration-150 ease-out"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-lg border border-border w-full max-w-[420px] mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in-0 duration-150 ease-out"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="text-sm font-semibold text-foreground">Edit Contact</div>
            <div className="text-xs text-slate-400 mt-0.5">Update contact details</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-surface-hover transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="eyebrow-label">
              Full Name <span className="text-red-400">*</span>
            </label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Juan dela Cruz"
              className="h-9 text-ssm"
              required
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="eyebrow-label">
              Role <span className="text-slate-400">(optional)</span>
            </label>
            <Select value={role || '__none__'} onValueChange={v => setRole(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-9 text-ssm">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-ssm text-slate-400">No role</SelectItem>
                <SelectItem value="poc" className="text-ssm">POC</SelectItem>
                <SelectItem value="stakeholder" className="text-ssm">Stakeholder</SelectItem>
                <SelectItem value="champion" className="text-ssm">Champion</SelectItem>
                <SelectItem value="blocker" className="text-ssm">Blocker</SelectItem>
                <SelectItem value="technical" className="text-ssm">Technical</SelectItem>
                <SelectItem value="executive" className="text-ssm">Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">
                Phone <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="h-9 text-ssm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">
                Email <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-9 text-ssm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="eyebrow-label">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Main decision-maker, prefers email"
              className="h-9 text-ssm"
            />
          </div>

          {updateContact.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {updateContact.error.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-ssm font-medium text-muted-foreground hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateContact.isPending || !canSubmit}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              {updateContact.isPending && (
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
