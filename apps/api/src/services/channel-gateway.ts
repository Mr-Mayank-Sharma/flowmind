import {
  ChannelGateway,
  TelegramAdapter,
  SlackAdapter,
  DiscordAdapter,
  WhatsAppAdapter,
  OpenHumanAdapter,
} from '@flowmind/channel-gateway'
import { logger } from "../infrastructure";

let gateway: ChannelGateway | undefined

export function getChannelGateway(): ChannelGateway {
  if (gateway) return gateway
  gateway = new ChannelGateway()

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN
  if (telegramToken) gateway.registerAdapter(new TelegramAdapter(telegramToken))

  const slackToken = process.env.SLACK_BOT_TOKEN
  const slackSecret = process.env.SLACK_SIGNING_SECRET
  if (slackToken && slackSecret) gateway.registerAdapter(new SlackAdapter(slackToken, slackSecret))

  const discordToken = process.env.DISCORD_BOT_TOKEN
  const discordAppId = process.env.DISCORD_APPLICATION_ID
  if (discordToken && discordAppId) gateway.registerAdapter(new DiscordAdapter(discordToken, discordAppId))

  const whatsappPhone = process.env.WHATSAPP_PHONE_NUMBER_ID
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (whatsappPhone && whatsappToken) gateway.registerAdapter(new WhatsAppAdapter(whatsappPhone, whatsappToken))

  const openhumanKey = process.env.OPENHUMAN_API_KEY
  if (openhumanKey) gateway.registerAdapter(new OpenHumanAdapter({ apiKey: openhumanKey }))

  return gateway
}

export async function setupChannelWebhooks(baseUrl: string): Promise<void> {
  const g = getChannelGateway()
  const targets: Array<[string, string]> = [
    ['telegram', `${baseUrl}/trpc/webhooks.telegram`],
    ['openhuman', `${baseUrl}/trpc/webhooks.ingest`],
  ]
  for (const [channel, url] of targets) {
    try {
      await g.setupWebhook(channel, url)
    } catch (err) {
      logger.warn({ err, channel }, "channel gateway failed to register webhook")
    }
  }
}