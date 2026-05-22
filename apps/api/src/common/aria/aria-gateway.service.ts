import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type AriaFireAndForgetInput = {
  sessionId: string
  content: string
  userId?: string | null
  workspacePath?: string
}

@Injectable()
export class AriaGatewayService {
  private readonly logger = new Logger(AriaGatewayService.name)
  private readonly gatewayUrl: string
  private readonly apiToken: string

  constructor(private readonly config: ConfigService) {
    this.gatewayUrl = (
      config.get<string>('ARIA_GATEWAY_URL') ?? 'https://aria-gateway.symph.co'
    ).replace(/\/+$/, '')
    this.apiToken = config.get<string>('ARIA_API_TOKEN') ?? ''
  }

  sendFireAndForget(input: AriaFireAndForgetInput): void {
    fetch(`${this.gatewayUrl}/v1/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        session_id: input.sessionId,
        content: input.content,
        user_id: input.userId ?? 'system',
        user_tier: 3,
        workspace_path: input.workspacePath ?? '/share/agency/products/symph-crm',
      }),
    }).catch((error) => {
      this.logger.error(`Aria fire-and-forget failed for session ${input.sessionId}: ${error}`)
    })
  }
}
