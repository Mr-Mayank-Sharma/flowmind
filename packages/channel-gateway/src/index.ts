export interface ChannelMessage {
  id: string
  channelType: 'telegram' | 'slack' | 'discord' | 'whatsapp' | 'email'
  channelId: string
  userId: string
  text?: string
  files?: Array<{ url: string; mimeType: string; name: string }>
  voiceUrl?: string
  replyTo?: string
  metadata?: Record<string, unknown>
  receivedAt: Date
}

export interface OutgoingMessage {
  channelId: string
  userId: string
  text?: string
  files?: Array<{ url: string; mimeType: string; name: string }>
  voiceUrl?: string
  replyTo?: string
  metadata?: Record<string, unknown>
}

export interface ChannelAdapter {
  readonly channelType: string
  sendMessage(message: OutgoingMessage): Promise<void>
  handleUpdate?(payload: unknown): Promise<ChannelMessage | null>
  setupWebhook?(url: string): Promise<void>
}

export class ChannelGateway {
  private adapters = new Map<string, ChannelAdapter>()

  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channelType, adapter)
  }

  getAdapter(channelType: string): ChannelAdapter | undefined {
    return this.adapters.get(channelType)
  }

  async sendMessage(channelType: string, message: OutgoingMessage): Promise<void> {
    const adapter = this.adapters.get(channelType)
    if (!adapter) throw new Error(`No adapter registered for channel: ${channelType}`)
    await adapter.sendMessage(message)
  }

  async processIncoming(channelType: string, payload: unknown): Promise<ChannelMessage | null> {
    const adapter = this.adapters.get(channelType)
    if (!adapter?.handleUpdate) throw new Error(`No handler for channel: ${channelType}`)
    return adapter.handleUpdate(payload)
  }

  async setupWebhook(channelType: string, url: string): Promise<void> {
    const adapter = this.adapters.get(channelType)
    if (!adapter?.setupWebhook) throw new Error(`Webhook not supported for channel: ${channelType}`)
    await adapter.setupWebhook(url)
  }

  getRegisteredChannels(): string[] {
    return Array.from(this.adapters.keys())
  }
}
