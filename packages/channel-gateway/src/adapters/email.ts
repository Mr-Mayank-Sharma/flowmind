import nodemailer from "nodemailer"
import type { ChannelAdapter, OutgoingMessage, ChannelMessage } from '../index.js'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
}

export interface ImapConfig {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
  mailbox?: string
}

export class EmailAdapter implements ChannelAdapter {
  readonly channelType = 'email'

  private watching = false
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private inboxCallback: ((msg: ChannelMessage) => void) | null = null
  private transporter: nodemailer.Transporter

  constructor(
    private smtp: SmtpConfig,
    private imap: ImapConfig,
  ) {
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    })
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const to = message.channelId
    const subject = (message.metadata?.subject as string) ?? 'FlowMind Message'

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.smtp.auth.user,
      to,
      subject,
      text: message.text ?? '',
    }

    if (message.replyTo) {
      mailOptions.inReplyTo = message.replyTo
      mailOptions.references = message.replyTo
    }

    if (message.files?.length) {
      mailOptions.attachments = await Promise.all(
        message.files.map(async (f) => {
          if (f.url.startsWith("http")) {
            const res = await fetch(f.url)
            const buffer = Buffer.from(await res.arrayBuffer())
            return { filename: f.name, content: buffer, contentType: f.mimeType }
          }
          return { filename: f.name, path: f.url, contentType: f.mimeType }
        })
      )
    }

    if (message.metadata?.html) {
      mailOptions.html = message.metadata.html as string
    }

    await this.transporter.sendMail(mailOptions)
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    return this.parseEmailPayload(payload)
  }

  async setupWebhook(url: string): Promise<void> {
    await Promise.resolve(url)
  }

  async watchInbox(callback: (msg: ChannelMessage) => void, intervalMs = 30000): Promise<void> {
    this.inboxCallback = callback
    this.watching = true

    this.pollTimer = setInterval(async () => {
      if (!this.watching) return
      try {
        const emails = await this.pollInbox()
        for (const email of emails) {
          const parsed = this.parseEmailPayload(email)
          if (parsed) {
            callback(parsed)
          }
        }
      } catch (err) {
        console.error('[EmailAdapter] Poll error', err)
      }
    }, intervalMs)
  }

  stopWatching(): void {
    this.watching = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async pollInbox(): Promise<Array<Record<string, unknown>>> {
    console.log('[EmailAdapter] Polling IMAP inbox', {
      host: this.imap.host,
      mailbox: this.imap.mailbox ?? 'INBOX',
    })
    return []
  }

  private parseEmailPayload(payload: unknown): ChannelMessage | null {
    const raw = payload as Record<string, unknown>

    const from = raw.from as Record<string, unknown> | undefined
    const to = raw.to as string | string[] | undefined

    return {
      id: String(raw.messageId ?? raw.id ?? ''),
      channelType: 'email',
      channelId: Array.isArray(to) ? to[0] ?? '' : to ?? '',
      userId: typeof from === 'object' ? String(from.address ?? '') : String(from ?? ''),
      text: (raw.text ?? raw.html ?? '') as string,
      files: raw.attachments
        ? (raw.attachments as Array<Record<string, unknown>>).map((a) => ({
            url: String(a.url ?? a.path ?? ''),
            mimeType: String(a.contentType ?? 'application/octet-stream'),
            name: String(a.filename ?? 'attachment'),
          }))
        : undefined,
      replyTo: raw.inReplyTo as string | undefined,
      metadata: {
        subject: raw.subject,
        cc: raw.cc,
        bcc: raw.bcc,
        date: raw.date,
      } as Record<string, unknown>,
      receivedAt: raw.date ? new Date(raw.date as string) : new Date(),
    }
  }
}
