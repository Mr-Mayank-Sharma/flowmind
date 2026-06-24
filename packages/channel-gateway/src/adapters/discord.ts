import type { ChannelAdapter, OutgoingMessage, ChannelMessage } from '../index.js'

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string; icon_url?: string }
  image?: { url: string }
  thumbnail?: { url: string }
  timestamp?: string
}

export class DiscordAdapter implements ChannelAdapter {
  readonly channelType = 'discord'

  constructor(
    private botToken: string,
    private applicationId: string,
  ) {}

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const embeds: DiscordEmbed[] = []

    const hasEmbeds = message.metadata?.embeds as DiscordEmbed[] | undefined
    if (hasEmbeds) {
      embeds.push(...hasEmbeds)
    }

    if (message.text) {
      embeds.unshift({
        description: message.text,
        color: 0x5865f2,
      })
    }

    const payload: Record<string, unknown> = {
      content: message.text ?? '',
      embeds: embeds.length ? embeds : undefined,
      message_reference: message.replyTo
        ? { message_id: message.replyTo }
        : undefined,
    }

    if (message.files?.length) {
      const attachments = message.files.map((f) => ({
        id: '0',
        url: f.url,
        filename: f.name,
        content_type: f.mimeType,
      }))
      payload.attachments = attachments
    }

    await this.call(
      `/channels/${message.channelId}/messages`,
      'POST',
      payload,
    )
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    const data = payload as Record<string, unknown>
    const msg = data.d as Record<string, unknown> | undefined ?? data
    if (!msg.id || msg.author?.bot) return null

    return {
      id: String(msg.id ?? ''),
      channelType: 'discord',
      channelId: String(msg.channel_id ?? ''),
      userId: String(msg.author?.id ?? ''),
      text: msg.content as string | undefined,
      files: msg.attachments
        ? (msg.attachments as Array<Record<string, unknown>>).map((a) => ({
            url: String(a.url ?? ''),
            mimeType: String(a.content_type ?? 'application/octet-stream'),
            name: String(a.filename ?? 'file'),
          }))
        : undefined,
      replyTo: msg.message_reference
        ? String((msg.message_reference as Record<string, unknown>).message_id ?? '')
        : undefined,
      metadata: {
        guildId: String(msg.guild_id ?? ''),
        channelId: String(msg.channel_id ?? ''),
        member: msg.member,
      } as Record<string, unknown>,
      receivedAt: new Date(),
    }
  }

  async setupWebhook(url: string): Promise<void> {
    // Discord interactions are handled via the Gateway or webhook
    // This stores the webhook endpoint for outgoing updates
    await Promise.resolve(url)
  }

  async createThread(channelId: string, name: string, messageId?: string): Promise<unknown> {
    return this.call(
      `/channels/${channelId}/threads`,
      'POST',
      messageId
        ? { name, message_id: messageId }
        : { name, type: 11 },
    )
  }

  async registerSlashCommand(
    command: { name: string; description: string; options?: Array<unknown> },
    guildId?: string,
  ): Promise<unknown> {
    const endpoint = guildId
      ? `/applications/${this.applicationId}/guilds/${guildId}/commands`
      : `/applications/${this.applicationId}/commands`
    return this.call(endpoint, 'POST', command)
  }

  private async call(
    endpoint: string,
    method: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const res = await fetch(`https://discord.com/api/v10${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.botToken}`,
      },
      body: JSON.stringify(body),
    })
    return res.json()
  }
}
