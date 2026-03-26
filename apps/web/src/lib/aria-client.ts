/**
 * Aria client — lightweight wrapper around Aria gateway REST API.
 *
 * Usage:
 *   const client = new AriaClient()
 *   for await (const event of client.sendAndStream({ content: "..." })) {
 *     console.log(event)
 *   }
 */

export type SendRequest = {
  content: string
  userId?: string
  userName?: string
  context?: Record<string, unknown>
}

export type StreamEvent =
  | { type: 'start'; sessionId: string }
  | { type: 'text'; data: { text: string } }
  | { type: 'tool'; data: { tool: string; input: Record<string, unknown>; result?: Record<string, unknown> } }
  | { type: 'done' }
  | { type: 'error'; data: { message: string } }

export class AriaClient {
  private gatewayUrl: string
  private apiToken: string
  private defaultWorkspacePath: string

  constructor(
    gatewayUrl?: string,
    apiToken?: string,
    workspacePath?: string,
  ) {
    this.gatewayUrl = gatewayUrl || process.env.NEXT_PUBLIC_ARIA_GATEWAY_URL || 'https://aria-gateway.symph.co'
    this.apiToken = apiToken || process.env.ARIA_API_TOKEN || ''
    this.defaultWorkspacePath = workspacePath || '/share/agency/products/symph-crm'
  }

  /**
   * Send a message and stream the response.
   * Yields StreamEvent objects as they arrive.
   */
  async *sendAndStream(req: SendRequest) {
    if (!this.apiToken) {
      yield { type: 'error', data: { message: 'Missing ARIA_API_TOKEN' } } as StreamEvent
      return
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          content: req.content,
          userId: req.userId,
          userName: req.userName,
          workspacePath: this.defaultWorkspacePath,
          context: req.context,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        yield {
          type: 'error',
          data: { message: `Gateway error ${res.status}: ${errText}` },
        } as StreamEvent
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        yield { type: 'error', data: { message: 'No response body' } } as StreamEvent
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as StreamEvent
              yield event
            } catch (e) {
              console.error('Failed to parse stream event:', line, e)
            }
          }
        }
      }

      buffer += decoder.decode()
      if (buffer.trim() && buffer.startsWith('data: ')) {
        try {
          const event = JSON.parse(buffer.slice(6)) as StreamEvent
          yield event
        } catch (e) {
          console.error('Failed to parse final stream event:', buffer, e)
        }
      }
    } catch (err) {
      yield {
        type: 'error',
        data: { message: err instanceof Error ? err.message : 'Unknown error' },
      } as StreamEvent
    }
  }
}
