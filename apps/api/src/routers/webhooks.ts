import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../middleware/trpc";

const CHANNEL_SECRET_ENV: Record<string, string | undefined> = {
  telegram: process.env.TELEGRAM_WEBHOOK_SECRET,
  slack: process.env.SLACK_WEBHOOK_SECRET,
  discord: process.env.DISCORD_WEBHOOK_SECRET,
  whatsapp: process.env.WHATSAPP_WEBHOOK_SECRET,
};

const ALLOW_UNVERIFIED_WEBHOOKS = process.env.ALLOW_UNVERIFIED_WEBHOOKS === "true";

function verifyChannelSecret(channel: string, provided: string | undefined): boolean {
  const expected = CHANNEL_SECRET_ENV[channel] || process.env.WEBHOOK_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production" && !ALLOW_UNVERIFIED_WEBHOOKS) {
      console.warn(`webhooks.${channel}: no webhook secret configured; request rejected in production`);
      return false;
    }
    return true;
  }
  return provided === expected;
}

function rejectWebhook(channel: string): never {
  throw new TRPCError({ code: "UNAUTHORIZED", message: `Invalid webhook secret for ${channel}` });
}

async function forwardToAgentRuntime(channel: string, payload: Record<string, unknown>): Promise<void> {
  const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
  let response: Response;
  try {
    response = await fetch(`${agentUrl}/webhook/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, payload }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Agent runtime unreachable while ingesting ${channel} webhook`,
      cause: err,
    });
  }
  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Agent runtime rejected ${channel} webhook with status ${response.status}`,
    });
  }
}

function extractText(channel: string, body: any): { text: string; userId: string; channelId: string; media?: { id: string; type: string; mimeType: string; filename: string } } {
  switch (channel) {
    case "telegram":
      return {
        text: body?.message?.text ?? "",
        userId: String(body?.message?.from?.id ?? ""),
        channelId: String(body?.message?.chat?.id ?? ""),
      };
    case "slack":
      return {
        text: body?.event?.text ?? body?.text ?? "",
        userId: body?.event?.user ?? body?.user_id ?? "",
        channelId: body?.event?.channel ?? body?.channel_id ?? "",
      };
    case "discord":
      return {
        text: body?.content ?? "",
        userId: body?.author?.id ?? body?.member?.user?.id ?? "",
        channelId: body?.channel_id ?? "",
      };
    case "whatsapp": {
      const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const mediaTypes = ["image", "video", "audio", "document"];
      let media: { id: string; type: string; mimeType: string; filename: string } | undefined;
      for (const mt of mediaTypes) {
        const entry = msg?.[mt];
        if (entry?.id) {
          media = { id: entry.id, type: mt, mimeType: entry.mime_type ?? "", filename: entry.filename ?? `media.${mt}` };
          break;
        }
      }
      return {
        text: msg?.text?.body ?? "",
        userId: msg?.from ?? "",
        channelId: body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? "",
        media,
      };
    }
    default:
      return {
        text: typeof body?.text === "string" ? body.text : JSON.stringify(body),
        userId: "",
        channelId: "",
      };
  }
}

export const webhooksRouter = router({
  whatsapp: publicProcedure
    .input(z.object({ body: z.any(), secret: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (!verifyChannelSecret("whatsapp", input.secret)) rejectWebhook("whatsapp");
      const extracted = extractText("whatsapp", input.body);
      await forwardToAgentRuntime("whatsapp", { ...extracted, raw: input.body });
      return { received: true, text: extracted.text, channelId: extracted.channelId };
    }),

  ingest: publicProcedure
    .input(z.object({
      channel: z.enum(["telegram", "slack", "discord", "whatsapp", "generic"]).default("generic"),
      body: z.any(),
      secret: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!verifyChannelSecret(input.channel, input.secret)) rejectWebhook(input.channel);

      const extracted = extractText(input.channel, input.body);

      await forwardToAgentRuntime(input.channel, { ...extracted, raw: input.body });
      return { received: true, channel: input.channel, text: extracted.text.slice(0, 200), userId: extracted.userId, channelId: extracted.channelId };
    }),

  telegram: publicProcedure
    .input(z.object({ body: z.any(), secret: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (!verifyChannelSecret("telegram", input.secret)) rejectWebhook("telegram");
      const { text, userId, channelId } = extractText("telegram", input.body);

      await forwardToAgentRuntime("telegram", { text, userId, channelId, raw: input.body });

      return { received: true, message: text, chatId: channelId };
    }),

  slack: publicProcedure
    .input(z.object({ body: z.any(), secret: z.string().optional() }))
    .mutation(async ({ input }) => {
      const body = input.body as any;
      if (body?.challenge) return { challenge: body.challenge };
      if (!verifyChannelSecret("slack", input.secret)) rejectWebhook("slack");

      const { text, userId, channelId } = extractText("slack", body);

      await forwardToAgentRuntime("slack", { text, userId, channelId, raw: body });

      return { received: true, text, channelId };
    }),

  discord: publicProcedure
    .input(z.object({ body: z.any(), secret: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (!verifyChannelSecret("discord", input.secret)) rejectWebhook("discord");
      const { text, userId, channelId } = extractText("discord", input.body);

      await forwardToAgentRuntime("discord", { text, userId, channelId, raw: input.body });

      return { received: true, text, channelId };
    }),
});