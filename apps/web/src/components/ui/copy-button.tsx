'use client'

import { useState, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

type CopyButtonProps = {
  value: string
  label?: string
  className?: string
}

export function CopyButton({ value, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    const ok = await copyToClipboard(value)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-control text-text-faint transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-ring',
        className,
      )}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check size={13} className="text-success-foreground" /> : <Copy size={13} />}
    </button>
  )
}
