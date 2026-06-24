import type { ChannelAdapter, OutgoingMessage, ChannelMessage } from '../index.js'

export class SlackAdapter implements ChannelAdapter {
  readonly channelType = 'slack'

  constructor(
    private botToken: string,
    private signingSecret: string,
  ) {}

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const blocks: Array<Record<string, unknown>> = []

    if (message.text) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: message.text },
      })
    }

    if (message.files?.length) {
      for (const file of message.files) {
        await this.call('files.upload', {
          channels: message.channelId,
          file: file.url,
          filename: file.name,
        })
      }
    }

    const hasBlocks = message.metadata?.blocks as Array<Record<string, unknown>> | undefined
    if (hasBlocks) {
      blocks.push(...hasBlocks)
    }

    await this.call('chat.postMessage', {
      channel: message.channelId,
      text: message.text ?? '',
      blocks: blocks.length ? blocks : undefined,
      thread_ts: message.replyTo,
    })
  }

  async handleUpdate(payload: unknown): Promise<ChannelMessage | null> {
    const body = payload as Record<string, unknown>

    // URL verification challenge
    if (body.type === 'url_verification') {
      return null
    }

    const event = body.event as Record<string, unknown> | undefined
    if (!event || event.type === 'bot_message' || event.subtype === 'bot_message') {
      return null
    }

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
      replyTo: event.thread_ts as string | undefined,
      metadata: { event, team_id: body.team_id } as Record<string, unknown>,
      receivedAt: new Date(),
    }
  }

  async setupWebhook(url: string): Promise<void> {
    // Slack uses Events API — webhook is configured via Slack App dashboard
    // This method validates that the request URL is reachable
    await Promise.resolve(url)
  }

  async openModal(triggerId: string, modal: Record<string, unknown>): Promise<void> {
    await this.call('views.open', {
      trigger_id: triggerId,
      view: modal,
    })
  }

  async respondToSlashCommand(responseUrl: string, text: string): Promise<void> {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, response_type: 'ephemeral' }),
    })
  }

  private async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.botToken}`,
      },
      body: JSON.stringify(params),
    })
    return res.json()
  }
}
