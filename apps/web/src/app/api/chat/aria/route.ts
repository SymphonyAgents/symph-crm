/**
 * POST /api/chat/aria
 *
 * Streams AI responses via the Aria gateway.
 * 1. POSTs message to /v1/chat/send → gets session_id
 * 2. Opens SSE stream from /v1/chat/stream → pipes to client
 *
 * Request body:
 * {
 *   content: string
 *   userId?: string
 *   userName?: string
 *   sessionId?: string
 *   workspaceId?: string
 *   dealId?: string
 *   attachment?: { filename: string; mimeType: string }
 * }
 *
 * Response: Server-Sent Events (text/event-stream)
 * event: text\ndata: {"text":"..."}\n\n
 * event: action\ndata: {...}\n\n
 * event: activity\ndata: {...}\n\n
 * event: done\ndata: {}\n\n
 * event: error\ndata: {"message":"..."}\n\n
 */

import { NextRequest, NextResponse } from 'next/server'

const GATEWAY_URL = (process.env.ARIA_GATEWAY_URL ?? 'https://aria-gateway.symph.co').replace(
  /\/+$/,
  '',
)
const INTERNAL_BASE = 'https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api/internal'
// Must NOT use NEXT_PUBLIC_ here — NEXT_PUBLIC vars are baked at build time
// as `http://localhost:3001/api` (Dockerfile ARG default) and the save call
// would silently fail. Use a server-only env var or the hardcoded fallback.
const NESTJS_API_BASE = (process.env.INTERNAL_API_URL ?? 'https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api').replace(/\/+$/, '')
// Default workspace used when the client doesn't pass one explicitly.
// Matches the single workspace seeded in the CRM DB.
const DEFAULT_WORKSPACE_ID = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

export async function POST(req: NextRequest) {
  const apiToken = process.env.ARIA_API_TOKEN
  if (!apiToken) {
    return NextResponse.json({ error: 'ARIA_API_TOKEN not configured' }, { status: 500 })
  }

  let body: {
    content?: string
    userId?: string
    userName?: string
    sessionId?: string
    workspaceId?: string
    dealId?: string
    attachment?: { filename: string; mimeType: string }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, userId, userName, sessionId, workspaceId, dealId, attachment } = body

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  // Aria gateway does not accept raw base64 — note attachments inline
  let messageContent = content
  if (attachment) {
    messageContent += `\n\n[Attachment: ${attachment.filename} (${attachment.mimeType})]`
  }

  // Build CRM system prompt additions
  const ws = workspaceId || DEFAULT_WORKSPACE_ID
  const internalSecret = process.env.INTERNAL_SECRET

  const promptLines: string[] = [
    '## Symph CRM Assistant',
    '',
    'You are Aria, acting as a CRM sales assistant for Symph — an AI-native software engineering agency based in the Philippines. Help Account Managers (AMs) track deals, manage companies, and capture client interactions.',
    '',
    '## Session context',
    `- User ID: ${userId ?? 'unknown'}`,
    `- Workspace ID: ${ws}`,
    `- Active deal: ${dealId ?? 'none'}`,
  ]

  if (internalSecret) {
    promptLines.push(
      '',
      '## CRM data access',
      'ALWAYS use the api_caller tool to answer questions about deals, companies, contacts, users, or activities.',
      'NEVER answer from memory or training data — every piece of CRM data MUST come from a live API call.',
      'If the API returns an empty list or 404, say "Not found in CRM" — do NOT guess or fabricate.',
      '',
      'All requests require:',
      `- Base URL: ${INTERNAL_BASE}`,
      `- Header: X-Internal-Secret: ${internalSecret}`,
      '',
      'Key endpoints (always include workspaceId):',
      `- GET /deals?workspaceId=${ws}&limit=20&sortBy=createdAt&sortOrder=desc — list recent deals`,
      `- GET /deals?workspaceId=${ws}&stage={stage}&limit=20 — filter by stage (e.g. "Follow Up", "Proposal", "Closed Won")`,
      '- GET /deals/{dealId} — deal details',
      `- GET /pipeline/summary?workspaceId=${ws} — pipeline overview with counts per stage`,
      `- GET /companies?workspaceId=${ws}&limit=20 — list companies`,
      `- GET /companies/search?q={query}&workspaceId=${ws} — search companies by name`,
      `- GET /contacts?workspaceId=${ws}&limit=20 — list contacts`,
      '- GET /activities?dealId={dealId}&limit=20 — deal activity log',
      '- PATCH /deals/{dealId} — update deal fields (stage, value, probability, closeDate, assignedTo)',
      '',
      '## Data integrity rules',
      '- AM names, company names, and deal stages in API responses come directly from the database.',
      '- If a user asks about a person who is not in the API results, say "Not found in CRM" — do not infer from your knowledge.',
      '- If a deal stage filter returns 0 results, say "No deals found in that stage" — do not invent deals.',
    )
  }

  promptLines.push(
    '',
    '## Response guidelines',
    '- Be concise and action-oriented.',
    '- Currency is PHP (Philippine Peso).',
    '- Confirm what API call you made and what it returned.',
    '- If the API call fails or returns an error, share the exact error with the user.',
  )

  const systemPromptAdditions = promptLines.join('\n')

  // Namespace CRM sessions so they don't collide with other Aria sessions
  const ariaSessionId = sessionId
    ? `crm-${sessionId}`
    : `crm-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Fire send to Aria without awaiting — so we can open the stream in parallel.
  // ariaSessionId is deterministic (we own it), so we don't need to wait for
  // the gateway to confirm receipt before connecting to the stream.
  // This removes one full HTTP round-trip from TTFB.
  const sendPromise = fetch(`${GATEWAY_URL}/v1/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      session_id: ariaSessionId,
      content: messageContent,
      user_id: userId,
      user_name: userName,
      // Assert T3 so the gateway honours system_prompt_additions.
      // Safe: this route is already gated by ARIA_API_TOKEN (server-side only).
      user_tier: 3,
      workspace_path: '/share/agency/products/symph-crm',
      system_prompt_additions: systemPromptAdditions,
    }),
  })

  // Open the SSE stream immediately in parallel.
  // The gateway holds the connection open until Aria starts writing.
  const openStream = () =>
    fetch(`${GATEWAY_URL}/v1/chat/stream?session_id=${encodeURIComponent(ariaSessionId)}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'text/event-stream',
      },
    })

  let streamResp: Response
  try {
    streamResp = await openStream()

    // If the gateway 404s the stream, the session may not exist yet (lost the
    // race with send). Wait for send to confirm, then retry once.
    if (streamResp.status === 404) {
      const sendResp = await sendPromise
      if (!sendResp.ok) {
        const errText = await sendResp.text()
        return NextResponse.json(
          { error: `Aria gateway send error: ${sendResp.status} ${errText}` },
          { status: sendResp.status },
        )
      }
      streamResp = await openStream()
    }

    if (!streamResp.ok) {
      const errText = await streamResp.text()
      return NextResponse.json(
        { error: `Aria gateway stream error: ${streamResp.status} ${errText}` },
        { status: streamResp.status },
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to open Aria stream: ${msg}` }, { status: 502 })
  }

  // Verify send succeeded — will already be resolved by the time we get here
  try {
    const sendResp = await sendPromise
    if (!sendResp.ok) {
      const errText = await sendResp.text()
      return NextResponse.json(
        { error: `Aria gateway send error: ${sendResp.status} ${errText}` },
        { status: sendResp.status },
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to reach Aria gateway: ${msg}` }, { status: 502 })
  }

  // Pipe the SSE stream line-by-line to the client.
  // Simultaneously parse events to collect the assembled assistant reply so we
  // can persist the user + assistant message pair to the NestJS backend once done.
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = streamResp.body?.getReader()
      if (!reader) {
        controller.enqueue(
          encoder.encode('event: error\ndata: {"message":"No response body from gateway"}\n\n'),
        )
        controller.close()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      // SSE event assembly for message persistence
      let currentEventType = ''
      const assembledTextParts: string[] = []

      const processEvent = (eventType: string, dataLines: string[]) => {
        if (!eventType) return
        const raw = dataLines.join('\n')
        if (eventType === 'text') {
          try {
            const parsed = JSON.parse(raw) as { text?: string }
            if (parsed.text) assembledTextParts.push(parsed.text)
          } catch { /* ignore malformed text events */ }
        }
      }

      let currentDataLines: string[] = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            // Forward to client unchanged
            controller.enqueue(encoder.encode(line + '\n'))

            // Parse SSE events for persistence
            if (line.startsWith('event: ')) {
              // New event — if we had a pending event (no data yet), just reset
              currentEventType = line.slice('event: '.length).trim()
              currentDataLines = []
            } else if (line.startsWith('data: ')) {
              currentDataLines.push(line.slice('data: '.length))
            } else if (line === '') {
              // Blank line = end of SSE event block
              processEvent(currentEventType, currentDataLines)

              if (currentEventType === 'done' && sessionId && userId) {
                const fullAssistantText = assembledTextParts.join('')
                // Fire-and-forget: persist user + assistant message pair.
                // x-user-id is required by the global RolesGuard for all POST mutations.
                fetch(`${NESTJS_API_BASE}/chat/sessions/${sessionId}/messages`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                  },
                  body: JSON.stringify({
                    userId,
                    userMessage: messageContent,
                    assistantMessage: fullAssistantText,
                  }),
                }).catch((err) => {
                  console.error('[chat/aria] saveMessages failed:', err)
                })
              }

              currentEventType = ''
              currentDataLines = []
            }
          }
        }

        // Flush remainder
        const remaining = buffer + decoder.decode()
        if (remaining.trim()) {
          controller.enqueue(encoder.encode(remaining + '\n'))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
