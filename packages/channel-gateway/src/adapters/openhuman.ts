import type { ChannelAdapter, OutgoingMessage, ChannelMessage } from '../index.js'

export interface OpenHumanConfig {
  apiKey: string
  baseUrl?: string
}

export class OpenHumanAdapter implements ChannelAdapter {
  readonly channelType = 'openhuman'

  private apiKey: string
  private baseUrl: string

  constructor(config: OpenHumanConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? 'https://api.openhuman.ai/v1'
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const payload: Record<string, unknown> = {
      conversation_id: message.channelId,
      message: message.text ?? '',
    }

    if (message.userId) {
      payload.user_id = message.userId
    }

    if (message.replyTo) {
      payload.reply_to = message.replyTo
    }

    if (message.files?.length) {
      payload.attachments = message.files.map((f) => ({
        url: f.url,
        type: f.mimeType,
        name: f.name,
      }))
    }

    if (message.voiceUrl) {
      payload.voice_url = message.voiceUrl
      delete payload.message
    }

    await this.call('/messages', payload)
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    const event = payload as Record<string, unknown>
    const eventType = event.type as string | undefined

    if (eventType === 'message' || eventType === 'conversation.created') {
      const msg = event.data as Record<string, unknown> | undefined
      if (!msg) return null

      return {
        id: String(msg.id ?? ''),
        channelType: 'openhuman',
        channelId: String(msg.conversation_id ?? event.conversation_id ?? ''),
        userId: String(msg.user_id ?? event.user_id ?? ''),
        text: (msg.text ?? msg.content ?? msg.message) as string | undefined,
        files: Array.isArray(msg.attachments)
          ? (msg.attachments as Array<Record<string, unknown>>).map((a) => ({
              url: String(a.url ?? ''),
              mimeType: String(a.type ?? a.mime_type ?? 'application/octet-stream'),
              name: String(a.name ?? a.filename ?? 'attachment'),
            }))
          : undefined,
        voiceUrl: (msg.voice_url ?? msg.audio_url) as string | undefined,
        replyTo: msg.reply_to ? String(msg.reply_to) : undefined,
        metadata: {
          raw: event,
          conversationType: msg.conversation_type ?? event.conversation_type,
        },
        receivedAt: new Date(),
      }
    }

    return null
  }

  async setupWebhook(url: string): Promise<void> {
    await this.call('/webhooks', {
      url,
      events: ['message', 'conversation.created'],
    })
  }

  private async call(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error')
      throw new Error(`OpenHuman API error ${res.status}: ${errorText}`)
    }

    return res.json()
  }
}
