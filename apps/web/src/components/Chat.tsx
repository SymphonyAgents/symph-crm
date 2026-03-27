'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import imageCompression from 'browser-image-compression'
import { cn } from '@/lib/utils'

// Default workspace — the single Symph workspace seeded at setup
const DEFAULT_WORKSPACE_ID = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionRecord = {
  tool: string
  input: Record<string, unknown>
  result: Record<string, unknown>
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actionsTaken?: ActionRecord[]
  attachment?: PendingAttachment
}

type AttachmentType = 'file' | 'image' | 'voice'

interface PendingAttachment {
  type: AttachmentType
  filename: string
  blob: Blob
  mimetype: string
  // For image previews
  previewUrl?: string
  // For voice: duration in seconds
  duration?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getAudioMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm'
}

function mimeToExt(mimetype: string): string {
  const base = mimetype.split(';')[0]
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  }
  return map[base] ?? 'webm'
}

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
].join(',')

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  { label: 'Pipeline summary', prompt: 'Give me a pipeline summary' },
  { label: 'Log a call', prompt: 'I just had a call with a prospect — help me log it' },
  { label: 'Create a deal', prompt: 'Create a new deal' },
  { label: 'Draft email', prompt: 'Draft a follow-up email for a prospect' },
]

// ─── Tool labels ──────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  search_companies: 'Searched companies',
  create_company: 'Created company',
  list_products_and_tiers: 'Listed products',
  create_deal: 'Created deal',
  update_deal: 'Updated deal',
  get_deal: 'Fetched deal',
  list_deals: 'Listed deals',
  write_deal_context: 'Updated deal context',
  read_deal_context: 'Read deal context',
  log_activity: 'Logged activity',
  add_contact: 'Added contact',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionPills({ actions }: { actions: ActionRecord[] }) {
  if (!actions.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-dim border border-primary-border text-[10.5px] font-medium text-primary"
        >
          <svg width={8} height={8} viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          {TOOL_LABELS[a.tool] ?? a.tool}
        </span>
      ))}
    </div>
  )
}

function AttachmentBubble({ attachment }: { attachment: PendingAttachment }) {
  if (attachment.type === 'image' && attachment.previewUrl) {
    return (
      <div className="flex justify-end mb-1">
        <img
          src={attachment.previewUrl}
          alt={attachment.filename}
          className="max-w-[200px] max-h-[150px] rounded-xl border border-black/[.08] object-cover"
        />
      </div>
    )
  }

  const icon =
    attachment.type === 'voice' ? (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    ) : (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
    )

  const label =
    attachment.type === 'voice' && attachment.duration
      ? `Voice note · ${formatDuration(attachment.duration)}`
      : attachment.filename

  return (
    <div className="flex justify-end mb-1">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-dim border border-primary-border text-[12px] text-slate-600">
        {icon}
        <span className="max-w-[160px] truncate">{label}</span>
      </div>
    </div>
  )
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment
  onRemove: () => void
}) {
  return (
    <div className="px-4 pt-2 pb-1 flex items-center gap-2">
      {attachment.type === 'image' && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.filename}
          className="w-10 h-10 rounded-lg object-cover border border-black/[.08] shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          {attachment.type === 'voice' ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-slate-700 truncate">{attachment.filename}</p>
        <p className="text-[11px] text-slate-400 capitalize">
          {attachment.type === 'voice' && attachment.duration
            ? `Voice · ${formatDuration(attachment.duration)}`
            : attachment.type}
        </p>
      </div>

      <button
        onClick={onRemove}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Audio Visualizer ─────────────────────────────────────────────────────────

function AudioVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.82
    const BAR_COUNT = analyser.frequencyBinCount  // 32
    const BAR_GAP = 2.5

    function draw() {
      if (!analyser || !canvas || !ctx) return

      const dataArray = new Uint8Array(BAR_COUNT)
      analyser.getByteFrequencyData(dataArray)

      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const totalGap = (BAR_COUNT - 1) * BAR_GAP
      const barWidth = (width - totalGap) / BAR_COUNT
      const centerY = height / 2

      for (let i = 0; i < BAR_COUNT; i++) {
        const raw = dataArray[i] / 255
        const amplitude = Math.max(0.06, raw)     // always-visible minimum
        const halfH = amplitude * centerY * 0.88
        const x = i * (barWidth + BAR_GAP)

        // opacity: dim baseline bars, bright active ones
        ctx.globalAlpha = 0.25 + raw * 0.75
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6c63ff'
        ctx.beginPath()
        // roundRect: x, y, w, h, radius
        ctx.roundRect(x, centerY - halfH, barWidth, halfH * 2, 1.5)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={36}
      className="flex-1 min-w-0"
      style={{ maxWidth: '220px' }}
    />
  )
}

// ─── Recording indicator ──────────────────────────────────────────────────────

function RecordingIndicator({
  elapsed,
  analyser,
  onStop,
}: {
  elapsed: number
  analyser: AnalyserNode | null
  onStop: () => void
}) {
  return (
    <div className="px-4 pt-3 pb-1 flex items-center gap-3">
      {/* Mic + timer */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-medium text-slate-500 tabular-nums w-[32px]">
          {formatDuration(elapsed)}
        </span>
      </div>

      {/* Visualizer */}
      <AudioVisualizer analyser={analyser} />

      {/* Stop */}
      <button
        onClick={onStop}
        className="shrink-0 h-7 px-3 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-600 hover:bg-red-100 active:scale-[0.96] transition-all"
      >
        Stop
      </button>
    </div>
  )
}

function renderContent(text: string) {
  return text.split('\n').map((line, lineIdx) => {
    const parts = line.split(/(\*\*.*?\*\*)/)
    const rendered = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
      }
      return <span key={partIdx}>{part}</span>
    })
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {rendered}
      </span>
    )
  })
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400"
          style={{
            animation: 'typingDot 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Chat({ dealId }: { dealId?: string }) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [focused, setFocused] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  // Live AnalyserNode — passed to AudioVisualizer while recording
  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  const userName = session?.user?.name?.split(' ')[0] || 'there'
  const userId = (session?.user as { id?: string })?.id || 'anonymous'

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // ── Image compression ────────────────────────────────────────────────────

  const compressImage = useCallback(async (file: File): Promise<File> => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
    } catch {
      return file // if compression fails, use original
    }
  }, [])

  // ── Attachment helpers ───────────────────────────────────────────────────

  const setImageAttachment = useCallback(async (file: File) => {
    const compressed = await compressImage(file)
    const previewUrl = URL.createObjectURL(compressed)
    setPendingAttachment({
      type: 'image',
      filename: compressed.name || file.name,
      blob: compressed,
      mimetype: compressed.type || file.type,
      previewUrl,
    })
  }, [compressImage])

  const handleFileSelected = useCallback(async (file: File) => {
    setAttachmentError(null)
    const ACCEPTED_MIMES = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ])
    if (!ACCEPTED_MIMES.has(file.type)) {
      setAttachmentError(`Unsupported file type: ${file.type || file.name.split('.').pop()}. Accepted: PDF, DOCX, XLSX, TXT, CSV, images.`)
      return
    }
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      await setImageAttachment(file)
    } else {
      setPendingAttachment({
        type: 'file',
        filename: file.name,
        blob: file,
        mimetype: file.type,
      })
    }
  }, [setImageAttachment])

  // ── Paste handler (detect clipboard images) ──────────────────────────────

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return

    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return

    const filename = `screenshot-${Date.now()}.${file.type.split('/')[1] || 'png'}`
    const namedFile = new File([file], filename, { type: file.type })
    await setImageAttachment(namedFile)
  }, [setImageAttachment])

  // ── Voice recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setAttachmentError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getAudioMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })

      // ── Web Audio API visualizer setup ───────────────────────────────────
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.82
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      audioContextRef.current = audioCtx
      setLiveAnalyser(analyser)
      // ─────────────────────────────────────────────────────────────────────

      audioChunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        // Close audio context and clear analyser
        audioCtx.close().catch(() => {})
        audioContextRef.current = null
        setLiveAnalyser(null)

        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const ext = mimeToExt(mimeType)
        const duration = (Date.now() - recordingStartRef.current) / 1000
        setPendingAttachment({
          type: 'voice',
          filename: `voice-${Date.now()}.${ext}`,
          blob,
          mimetype: mimeType,
          duration,
        })
        setRecording(false)
        setRecordingElapsed(0)
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }

      mediaRecorderRef.current = recorder
      recordingStartRef.current = Date.now()
      recorder.start(200)
      setRecording(true)
      setRecordingElapsed(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - recordingStartRef.current) / 1000))
      }, 1000)
    } catch (err) {
      const isDenied = err instanceof DOMException && err.name === 'NotAllowedError'
      setAttachmentError(
        isDenied
          ? 'Microphone access denied — allow it in your browser settings.'
          : 'Could not start recording. Check your microphone.'
      )
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording()
    else startRecording()
  }, [recording, startRecording, stopRecording])

  const clearAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl)
    }
    setPendingAttachment(null)
    setAttachmentError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [pendingAttachment])

  // ── Send message ─────────────────────────────────────────────────────────

  async function sendMessage(text: string, attachment?: PendingAttachment) {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachment,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingAttachment(null)
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setTyping(true)
    setApiError(null)

    const assistantMsgId = `a-${Date.now()}`

    try {
      // Prepare request body
      let attachmentData: { filename: string; mimeType: string; base64: string } | undefined
      if (attachment) {
        const reader = new FileReader()
        attachmentData = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1] || ''
            resolve({
              filename: attachment.filename,
              mimeType: attachment.mimetype,
              base64,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(attachment.blob)
        })
      }

      // Call Aria streaming endpoint
      const res = await fetch('/api/chat/aria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          userId,
          userName: 'AM',
          sessionId,
          dealId,
          attachment: attachmentData,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API error ${res.status}: ${errText}`)
      }

      // Stream response
      let assistantText = ''
      const actions: ActionRecord[] = []
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      // Initialize assistant message placeholder
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          actionsTaken: [],
        },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'text' && event.data?.text) {
                assistantText += event.data.text
                // Stream text updates
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: assistantText, actionsTaken: actions }
                      : m,
                  ),
                )
              } else if (event.type === 'tool' && event.data?.tool) {
                actions.push({
                  tool: event.data.tool,
                  input: event.data.input || {},
                  result: event.data.result || {},
                })
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId ? { ...m, actionsTaken: actions } : m,
                  ),
                )
              } else if (event.type === 'error') {
                throw new Error(event.data?.message || 'Stream error')
              }
            } catch (parseErr) {
              console.error('Failed to parse stream event:', line, parseErr)
            }
          }
        }
      }

      buffer += decoder.decode()
      if (buffer.trim().startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6))
          if (event.type === 'text' && event.data?.text) {
            assistantText += event.data.text
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: assistantText } : m,
              ),
            )
          }
        } catch (parseErr) {
          console.error('Failed to parse final stream event:', buffer, parseErr)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setApiError(msg)
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setTyping(false)
    }
  }

  function handleSubmit() {
    const trimmed = input.trim()
    if ((!trimmed && !pendingAttachment) || typing) return
    sendMessage(trimmed, pendingAttachment ?? undefined)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = (input.trim() || pendingAttachment) && !typing

  // ── Input box ────────────────────────────────────────────────────────────

  const inputBox = (
    <div className="max-w-[680px] w-full mx-auto">
      <div
        className={cn(
          'rounded-2xl bg-white transition-all duration-150',
          focused
            ? 'border border-black/20 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_3px_rgba(0,0,0,0.05)]'
            : 'border border-black/[.08] shadow-[var(--shadow-card)]'
        )}
      >
        {/* Recording indicator + visualizer */}
        {recording && (
          <RecordingIndicator
            elapsed={recordingElapsed}
            analyser={liveAnalyser}
            onStop={stopRecording}
          />
        )}

        {/* Attachment preview */}
        {pendingAttachment && !recording && (
          <AttachmentPreview attachment={pendingAttachment} onRemove={clearAttachment} />
        )}

        <div className={cn('px-4 pt-4 pb-2', (pendingAttachment || recording) && 'pt-2')}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              pendingAttachment
                ? 'Add a message, or just send the attachment…'
                : recording
                ? 'Recording… press Stop when done'
                : 'How can I help you today?'
            }
            disabled={typing}
            rows={1}
            className={cn(
              'w-full bg-transparent border-none outline-none text-[14px] text-slate-900 leading-[1.6] resize-none overflow-hidden placeholder:text-slate-400',
              typing && 'opacity-50'
            )}
            style={{ minHeight: '28px', maxHeight: '160px' }}
          />
        </div>

        {/* Attachment / mic error */}
        {attachmentError && (
          <div className="mx-4 mb-1 mt-0.5 flex items-center gap-1.5 text-[11px] text-red-500">
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {attachmentError}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={typing || recording}
            title="Attach file or image"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Voice record */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={typing || !!pendingAttachment}
            title={recording ? 'Stop recording' : 'Record voice note'}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
              recording
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            )}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400">
            <span className="text-[12px] font-medium">Symph AI</span>
            {sessionId && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" title="Session active" />
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 active:scale-[0.94]',
              canSubmit
                ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                : 'bg-slate-100 cursor-default'
            )}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={canSubmit ? '#fff' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  // ── Empty state ──────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0 && !typing

  if (isEmpty) {
    return (
      <div
        ref={containerRef}
        className="h-full flex flex-col items-center justify-center px-6"
      >
        <div className="flex flex-col items-center gap-6 max-w-[680px] w-full">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-[15px] shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              S
            </div>
            <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">
              {getGreeting()}, {userName}
            </h1>
          </div>

          {inputBox}

          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.prompt}
                onClick={() => sendMessage(p.prompt)}
                className="px-3.5 py-2 rounded-xl bg-white border border-black/[.08] text-[12px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 active:scale-[0.98] transition-colors duration-150 shadow-[var(--shadow-card)]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Active chat ──────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] w-full mx-auto px-6 pt-8 pb-4 flex flex-col gap-5">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div>
                  {msg.attachment && <AttachmentBubble attachment={msg.attachment} />}
                  {msg.content && (
                    <div className="flex justify-end">
                      <div className="max-w-[78%] px-4 py-3 rounded-2xl bg-primary-dim border border-primary-border text-[13px] text-slate-900 leading-[1.6]">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-[13px] text-slate-700 leading-[1.75] whitespace-pre-wrap">
                    {renderContent(msg.content)}
                  </div>
                  {msg.actionsTaken && msg.actionsTaken.length > 0 && (
                    <ActionPills actions={msg.actionsTaken} />
                  )}
                </div>
              )}
            </div>
          ))}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-6 pb-5 pt-3 border-t border-black/[.06]">
        {apiError && (
          <p className="text-[11px] text-red-500 mb-2 text-center">{apiError}</p>
        )}
        {inputBox}
      </div>
    </div>
  )
}
