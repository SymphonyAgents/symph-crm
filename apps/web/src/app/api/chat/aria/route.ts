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
 *   sessionId?: string
 *   workspaceId?: string
 *   dealId?: string
 *   attachment?: { filename: string; mimeType: string; base64?: string }
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
function resolveServerApiBase(): string {
  const raw = process.env.INTERNAL_API_URL ?? process.env.API_URL ?? 'http://localhost:4000/api'
  const normalized = raw.replace(/\/+$/, '')
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

const NESTJS_API_BASE = resolveServerApiBase()
const INTERNAL_BASE = `${NESTJS_API_BASE}/internal`
// Default workspace used when the client doesn't pass one explicitly.
// Matches the single workspace seeded in the CRM DB.
const DEFAULT_WORKSPACE_ID = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

export async function POST(req: NextRequest) {
  const apiToken = process.env.ARIA_API_TOKEN
  if (!apiToken) {
    return NextResponse.json({ error: 'ARIA_API_TOKEN not configured' }, { status: 500 })
  }

  const cookieHeader = req.headers.get('cookie') ?? ''
  const sessionRes = await fetch(`${NESTJS_API_BASE}/auth/session`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: 'no-store',
  })
  if (!sessionRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const session = await sessionRes.json() as { user?: { id?: string; name?: string | null; email?: string | null } | null }
  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userName = session.user?.name ?? session.user?.email ?? 'CRM user'

  let body: {
    content?: string
    sessionId?: string
    workspaceId?: string
    dealId?: string
    attachment?: { filename: string; mimeType: string; base64?: string }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, sessionId, workspaceId, dealId, attachment } = body

  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  // Build message content — parse file attachments into text when possible
  let messageContent = content
  if (attachment) {
    const attachmentNote = `[Attachment: ${attachment.filename} (${attachment.mimeType})]`
    let fileText = ''

    if (attachment.base64) {
      try {
        const parseRes = await fetch(`${NESTJS_API_BASE}/chat/parse-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            base64: attachment.base64,
            mimeType: attachment.mimeType,
            filename: attachment.filename,
          }),
        })
        if (parseRes.ok) {
          const parsed = (await parseRes.json()) as { text?: string }
          if (parsed.text) {
            fileText = parsed.text
          }
        }
      } catch (err) {
        console.error('[chat/aria] parse-file failed, falling back to metadata only:', err)
      }
    }

    if (fileText) {
      // Truncate very large files to avoid blowing up the prompt context
      const MAX_FILE_CHARS = 8000
      const truncatedText =
        fileText.length > MAX_FILE_CHARS
          ? fileText.slice(0, MAX_FILE_CHARS) + `\n\n[... truncated at ${MAX_FILE_CHARS} characters]`
          : fileText
      messageContent += `\n\n${attachmentNote}\n\n<file_content>\n${truncatedText}\n</file_content>`
    } else {
      messageContent += `\n\n${attachmentNote}`
    }
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
      '- For every POST, PUT, PATCH, or DELETE request, include Header: X-Performed-By: the current User ID from Session context.',
      '- Do not use your own ID, a name, an email, or the string "aria" for X-Performed-By. Use the exact current User ID.',
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
      `- POST /companies  body: { "name": "...", "workspaceId": "${ws}" } — create a new brand/company`,
      `- POST /deals  body: { "title": "...", "companyId": "...", "workspaceId": "${ws}", "stage": "lead" } — create a new deal`,
      '',
      '## Creating a deal for a NEW brand (two-step flow)',
      'If the user asks to create a deal and the brand/company does not yet exist in CRM:',
      `Step 1 — POST /companies  body: { "name": "<brand name>", "workspaceId": "${ws}" }`,
      'Step 2 — Use the returned company "id" as companyId in:',
      `         POST /deals  body: { "title": "<deal title>", "companyId": "<company id from step 1>", "workspaceId": "${ws}", "stage": "lead" }`,
      'Confirm both created records (IDs, names) to the user after both calls succeed.',
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

  // User message is now saved by the frontend (Chat.tsx) before calling this
  // route, so we no longer duplicate the save here. The frontend awaits the
  // save to guarantee the message is in the DB before any page navigation.

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
                // Fire-and-forget: persist the assistant reply.
                // The user message was already saved at request start — only the assistant half remains.
                fetch(`${NESTJS_API_BASE}/chat/sessions/${sessionId}/messages/assistant`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(cookieHeader ? { cookie: cookieHeader } : {}),
                  },
                  body: JSON.stringify({
                    assistantMessage: fullAssistantText,
                  }),
                }).catch((err) => {
                  console.error('[chat/aria] saveAssistantMessage failed:', err)
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
