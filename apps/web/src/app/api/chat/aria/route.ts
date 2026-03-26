/**
 * POST /api/chat/aria
 *
 * Streams AI responses using Aria gateway.
 *
 * Request body:
 * {
 *   content: string           // User message
 *   userId?: string           // Session user ID
 *   userName?: string         // User display name
 *   sessionId?: string        // Optional session context
 *   dealId?: string           // Optional deal context
 *   attachment?: {            // Optional file attachment
 *     filename: string
 *     mimeType: string
 *     base64: string
 *   }
 * }
 *
 * Response: Server-Sent Events (text/event-stream)
 * data: {type:"text", data:{text:"..."}}\n\n
 * data: {type:"tool", data:{tool:"...", input:{...}, result:{...}}}\n\n
 * data: {type:"done"}\n\n
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { content, userId, userName, sessionId, dealId, attachment } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const apiToken = process.env.ARIA_API_TOKEN
    if (!apiToken) {
      return NextResponse.json({ error: 'ARIA_API_TOKEN not configured' }, { status: 500 })
    }

    const gatewayUrl = process.env.ARIA_GATEWAY_URL || 'https://aria-gateway.symph.co'

    // Build the message with context
    let prompt = content
    if (sessionId) prompt += `\n[Session: ${sessionId}]`
    if (dealId) prompt += `\n[Deal: ${dealId}]`

    // Stream response from Aria gateway
    const res = await fetch(`${gatewayUrl}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        content: prompt,
        userId,
        userName,
        workspacePath: '/share/agency/products/symph-crm',
        context: { sessionId, dealId },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json(
        { error: `Gateway error: ${res.status} ${errText}` },
        { status: res.status },
      )
    }

    // Pipe the gateway's stream directly to the client
    const encoder = new TextEncoder()
    const customReadable = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader()
        if (!reader) {
          controller.enqueue(encoder.encode('data: {"type":"error","data":{"message":"No response body"}}\n\n'))
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim()) {
                // Forward as-is if it's already SSE format, or wrap it
                if (line.startsWith('data:')) {
                  controller.enqueue(encoder.encode(line + '\n\n'))
                } else {
                  try {
                    const json = JSON.parse(line)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`))
                  } catch {
                    // Skip unparseable lines
                  }
                }
              }
            }
          }

          buffer += decoder.decode()
          if (buffer.trim()) {
            if (buffer.startsWith('data:')) {
              controller.enqueue(encoder.encode(buffer + '\n\n'))
            } else {
              try {
                const json = JSON.parse(buffer)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`))
              } catch {
                // Skip unparseable final buffer
              }
            }
          }

          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          controller.enqueue(encoder.encode(`data: {"type":"error","data":{"message":"${msg}"}}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
