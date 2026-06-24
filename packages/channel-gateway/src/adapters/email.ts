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

  constructor(
    private smtp: SmtpConfig,
    private imap: ImapConfig,
  ) {}

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const from = this.smtp.auth.user
    const to = message.channelId
    const subject = (message.metadata?.subject as string) ?? 'FlowMind Message'

    const payload: Record<string, unknown> = {
      from,
      to,
      subject,
      text: message.text ?? '',
    }

    if (message.replyTo) {
      payload.inReplyTo = message.replyTo
      payload.references = message.replyTo
    }

    if (message.files?.length) {
      payload.attachments = message.files.map((f) => ({
        filename: f.name,
        path: f.url,
        contentType: f.mimeType,
      }))
    }

    if (message.metadata?.html) {
      payload.html = message.metadata.html
    }

    // SMTP send — placeholder for nodemailer or similar
    console.log('[EmailAdapter] Sending email via SMTP', {
      host: this.smtp.host,
      payload,
    })
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    return this.parseEmailPayload(payload)
  }

  async setupWebhook(url: string): Promise<void> {
    // Email uses IMAP polling or webhook services like SendGrid/SparkPost
    // This is a placeholder for configuring an inbound email webhook
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
    // IMAP fetch placeholder — real implementation uses imapflow or node-imap
    console.log('[EmailAdapter] Polling IMAP inbox', {
      host: this.imap.host,
      mailbox: this.imap.mailbox ?? 'INBOX',
    })
    return []
  }

  private async sendEmail(payload: Record<string, unknown>): Promise<void> {
    // SMTP transport placeholder — real implementation uses nodemailer
    console.log('[EmailAdapter] Sending via SMTP', payload)
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
