import type { ChannelAdapter, OutgoingMessage, ChannelMessage } from '../index.js'

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channelType = 'whatsapp'

  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private apiVersion = 'v21.0',
  ) {}

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const recipient = message.channelId

    if (message.text) {
      await this.call({
        messaging_product: 'whatsapp',
        to: recipient,
        text: { body: message.text },
        context: message.replyTo
          ? { message_id: message.replyTo }
          : undefined,
      })
    }

    if (message.files?.length) {
      for (const file of message.files) {
        const mediaType = file.mimeType.startsWith('image')
          ? 'image'
          : file.mimeType.startsWith('video')
            ? 'video'
            : file.mimeType.startsWith('audio')
              ? 'audio'
              : 'document'
        await this.call({
          messaging_product: 'whatsapp',
          to: recipient,
          [mediaType]: { link: file.url, caption: message.text },
        })
      }
    }

    if (message.voiceUrl) {
      await this.call({
        messaging_product: 'whatsapp',
        to: recipient,
        audio: { link: message.voiceUrl },
      })
    }
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    const body = payload as Record<string, unknown>
    const entry = (body.entry as Array<Record<string, unknown>> | undefined)?.[0]
    const change = (entry?.changes as Array<Record<string, unknown>> | undefined)?.[0]
    const value = change?.value as Record<string, unknown> | undefined
    const msg = (value?.messages as Array<Record<string, unknown>> | undefined)?.[0]
    const contact = (value?.contacts as Array<Record<string, unknown>> | undefined)?.[0]
    if (!msg) return null

    const textBody =
      (msg.text as Record<string, unknown> | undefined)?.body ??
      (msg.caption as string | undefined)

    const hasMedia = msg.image ?? msg.video ?? msg.audio ?? msg.document
    const mediaType = msg.image
      ? 'image'
      : msg.video
        ? 'video'
        : msg.audio
          ? 'audio'
          : 'document'

    const mediaEntry = msg[mediaType] as Record<string, unknown> | undefined

    return {
      id: String(msg.id ?? ''),
      channelType: 'whatsapp',
      channelId: String(msg.from ?? ''),
      userId: String(contact?.wa_id ?? msg.from ?? ''),
      text: textBody as string | undefined,
      files: hasMedia
        ? [
            {
              url: '',
              mimeType: String(mediaEntry?.mime_type ?? 'application/octet-stream'),
              name: String(mediaEntry?.filename ?? `media.${mediaType}`),
            },
          ]
        : undefined,
      voiceUrl: msg.audio && (msg.audio as Record<string, unknown>).mime_type === 'audio/ogg; codecs=opus' ? '' : undefined,
      replyTo: (msg.context as Record<string, unknown> | undefined)?.id as string | undefined,
      metadata: {
        wamId: entry?.id,
        profile: contact?.profile,
        messageType: msg.type,
      } as Record<string, unknown>,
      receivedAt: new Date(),
    }
  }

  async setupWebhook(url: string): Promise<void> {
    // WhatsApp Cloud API webhooks are configured in the Meta Developer dashboard
    // This method is a placeholder for programmatic registration if Meta exposes it
    await Promise.resolve(url)
  }

  private async call(body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
      },
    )
    return res.json()
  }
}
