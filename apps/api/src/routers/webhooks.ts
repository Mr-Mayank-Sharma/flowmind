import { z } from "zod";
import { router, publicProcedure } from "../middleware/trpc";

function extractText(channel: string, body: any): { text: string; userId: string; channelId: string } {
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
    case "whatsapp":
      return {
        text: body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ?? "",
        userId: body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ?? "",
        channelId: body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? "",
      };
    default:
      return {
        text: typeof body?.text === "string" ? body.text : JSON.stringify(body),
        userId: "",
        channelId: "",
      };
  }
}

export const webhooksRouter = router({
  ingest: publicProcedure
    .input(z.object({
      channel: z.enum(["telegram", "slack", "discord", "whatsapp", "generic"]).default("generic"),
      body: z.any(),
      secret: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const webhookSecret = process.env.WEBHOOK_SECRET || "";
      if (webhookSecret && input.secret !== webhookSecret) {
        return { received: false, error: "invalid secret" };
      }

      const { text, userId, channelId } = extractText(input.channel, input.body);

      const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
      await fetch(`${agentUrl}/webhook/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: input.channel, payload: { text, userId, channelId, raw: input.body } }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});

      return { received: true, channel: input.channel, text: text.slice(0, 200), userId, channelId };
    }),

  telegram: publicProcedure
    .input(z.object({ body: z.any() }))
    .mutation(async ({ input }) => {
      const { text, userId, channelId } = extractText("telegram", input.body);

      const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
      await fetch(`${agentUrl}/webhook/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "telegram", payload: { text, userId, channelId, raw: input.body } }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});

      return { received: true, message: text, chatId: channelId };
    }),

  slack: publicProcedure
    .input(z.object({ body: z.any() }))
    .mutation(async ({ input }) => {
      const body = input.body as any;
      if (body?.challenge) return { challenge: body.challenge };

      const { text, userId, channelId } = extractText("slack", body);

      const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
      await fetch(`${agentUrl}/webhook/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "slack", payload: { text, userId, channelId, raw: body } }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});

      return { received: true, text, channelId };
    }),

  discord: publicProcedure
    .input(z.object({ body: z.any() }))
    .mutation(async ({ input }) => {
      const { text, userId, channelId } = extractText("discord", input.body);

      const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
      await fetch(`${agentUrl}/webhook/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "discord", payload: { text, userId, channelId, raw: input.body } }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});

      return { received: true, text, channelId };
    }),
});
