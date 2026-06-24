import type { ChannelMessage } from './index.js'

export interface RawPayload {
  body?: unknown
  raw: Record<string, unknown>
  channelType: 'telegram' | 'slack' | 'discord' | 'whatsapp' | 'email'
}

export function normalizeMessage(payload: RawPayload): ChannelMessage | null {
  switch (payload.channelType) {
    case 'telegram':
      return normalizeTelegram(payload)
    case 'slack':
      return normalizeSlack(payload)
    case 'discord':
      return normalizeDiscord(payload)
    case 'whatsapp':
      return normalizeWhatsApp(payload)
    case 'email':
      return normalizeEmail(payload)
    default:
      return null
  }
}

function normalizeTelegram(payload: RawPayload): ChannelMessage | null {
  const msg = payload.body as Record<string, unknown> | undefined
  if (!msg) return null
  const chat = msg.chat as Record<string, unknown> | undefined
  const from = msg.from as Record<string, unknown> | undefined
  return {
    id: String(msg.message_id ?? ''),
    channelType: 'telegram',
    channelId: String(chat?.id ?? ''),
    userId: String(from?.id ?? ''),
    text: msg.text as string | undefined,
    replyTo: msg.reply_to_message
      ? String((msg.reply_to_message as Record<string, unknown>).message_id ?? '')
      : undefined,
    metadata: { chat, from } as Record<string, unknown>,
    receivedAt: new Date(),
  }
}

function normalizeSlack(payload: RawPayload): ChannelMessage | null {
  const event = payload.body as Record<string, unknown> | undefined
  if (!event) return null
  return {
    id: String(event.client_msg_id ?? event.event_ts ?? ''),
    channelType: 'slack',
    channelId: String(event.channel ?? ''),
    userId: String(event.user ?? ''),
    text: event.text as string | undefined,
    files: event.files
      ? (event.files as Array<Record<string, unknown>>).map((f) => ({
          url: String(f.url_private ?? f.url ?? ''),
          mimeType: String(f.mimetype ?? 'application/octet-stream'),
          name: String(f.name ?? 'file'),
        }))
      : undefined,
    metadata: { event } as Record<string, unknown>,
    receivedAt: new Date(),
  }
}

function normalizeDiscord(payload: RawPayload): ChannelMessage | null {
  const msg = payload.body as Record<string, unknown> | undefined
  if (!msg) return null
  return {
    id: String(msg.id ?? ''),
    channelType: 'discord',
    channelId: String(msg.channel_id ?? ''),
    userId: String(msg.author?.id ?? msg.member?.user?.id ?? ''),
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
    metadata: msg as Record<string, unknown>,
    receivedAt: new Date(),
  }
}

function normalizeWhatsApp(payload: RawPayload): ChannelMessage | null {
  const msg = payload.body as Record<string, unknown> | undefined
  if (!msg) return null
  const textEntry =
    (msg.text as Record<string, unknown> | undefined)?.body ??
    (msg.caption as string | undefined)
  return {
    id: String(msg.id ?? msg.key?.id ?? ''),
    channelType: 'whatsapp',
    channelId: String(msg.chatId ?? msg.key?.remoteJid ?? ''),
    userId: String(msg.author ?? msg.key?.participant ?? msg.from ?? ''),
    text: textEntry as string | undefined,
    files: msg.mediaKey
      ? [{ url: '', mimeType: String(msg.mimetype ?? 'application/octet-stream'), name: msg.fileName as string ?? 'media' }]
      : undefined,
    voiceUrl: msg.mediaKey && msg.mimetype === 'audio/ogg; codecs=opus' ? '' : undefined,
    metadata: msg as Record<string, unknown>,
    receivedAt: new Date(),
  }
}

function normalizeEmail(payload: RawPayload): ChannelMessage | null {
  const msg = payload.body as Record<string, unknown> | undefined
  if (!msg) return null
  return {
    id: String(msg.messageId ?? ''),
    channelType: 'email',
    channelId: String(msg.inbox ?? ''),
    userId: String(msg.from?.address ?? msg.from ?? ''),
    text: msg.text ?? msg.html ?? msg.subject ?? '',
    files: msg.attachments
      ? (msg.attachments as Array<Record<string, unknown>>).map((a) => ({
          url: String(a.url ?? a.path ?? ''),
          mimeType: String(a.contentType ?? 'application/octet-stream'),
          name: String(a.filename ?? 'attachment'),
        }))
      : undefined,
    replyTo: msg.inReplyTo as string | undefined,
    metadata: msg as Record<string, unknown>,
    receivedAt: msg.date ? new Date(msg.date as string) : new Date(),
  }
}
