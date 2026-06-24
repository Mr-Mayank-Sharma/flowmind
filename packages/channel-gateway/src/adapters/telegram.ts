import type { ChannelAdapter, OutgoingMessage, ChannelMessage } from '../index.js'

export class TelegramAdapter implements ChannelAdapter {
  readonly channelType = 'telegram'

  constructor(private botToken: string) {}

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const payload: Record<string, unknown> = {
      chat_id: message.channelId,
      text: message.text ?? '',
    }

    if (message.replyTo) {
      payload.reply_to_message_id = Number(message.replyTo)
    }

    if (message.files?.length) {
      // media group support
      const media = message.files.map((f, i) => ({
        type: f.mimeType.startsWith('image') ? 'photo' : 'document',
        media: f.url,
        caption: i === 0 ? message.text : undefined,
      }))
      payload.media = media
    }

    const hasInlineKeyboard = message.metadata?.inlineKeyboard
    if (hasInlineKeyboard) {
      payload.reply_markup = {
        inline_keyboard: hasInlineKeyboard as unknown[][],
      }
    }

    if (message.voiceUrl) {
      payload.voice = message.voiceUrl
      delete payload.text
    }

    await this.call('sendMessage', payload)
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    const update = payload as Record<string, unknown>
    const msg = (update.message ?? update.edited_message ?? update.channel_post) as
      | Record<string, unknown>
      | undefined
    if (!msg) return null

    const chat = msg.chat as Record<string, unknown> | undefined
    const from = msg.from as Record<string, unknown> | undefined

    return {
      id: String(msg.message_id ?? ''),
      channelType: 'telegram',
      channelId: String(chat?.id ?? ''),
      userId: String(from?.id ?? ''),
      text: (msg.text ?? msg.caption) as string | undefined,
      files: msg.photo
        ? (msg.photo as Array<Record<string, unknown>>).map((p) => ({
            url: `https://api.telegram.org/file/bot${this.botToken}/${String(p.file_id ?? '')}`,
            mimeType: 'image/jpeg',
            name: `photo_${String(p.file_unique_id ?? '')}.jpg`,
          }))
        : undefined,
      voiceUrl: msg.voice
        ? `https://api.telegram.org/file/bot${this.botToken}/${String((msg.voice as Record<string, unknown>).file_id ?? '')}`
        : undefined,
      replyTo: msg.reply_to_message
        ? String((msg.reply_to_message as Record<string, unknown>).message_id ?? '')
        : undefined,
      metadata: update as Record<string, unknown>,
      receivedAt: new Date(),
    }
  }

  async setupWebhook(url: string): Promise<void> {
    await this.call('setWebhook', { url })
  }

  private async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    const apiUrl = `https://api.telegram.org/bot${this.botToken}/${method}`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return res.json()
  }
}
