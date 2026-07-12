import { z } from "zod";
import { router, publicProcedure } from "../middleware/trpc";

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
    .input(z.object({ body: z.any() }))
    .mutation(async ({ input }) => {
      const extracted = extractText("whatsapp", input.body);
      const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
      await fetch(`${agentUrl}/webhook/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "whatsapp", payload: { ...extracted, raw: input.body } }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});
      return { received: true, text: extracted.text, channelId: extracted.channelId };
    }),

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

      const extracted = extractText(input.channel, input.body);

      const agentUrl = process.env.AGENT_RUNTIME_URL || "http://localhost:8001";
      await fetch(`${agentUrl}/webhook/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: input.channel, payload: { ...extracted, raw: input.body } }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});
      return { received: true, channel: input.channel, text: extracted.text.slice(0, 200), userId: extracted.userId, channelId: extracted.channelId };
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
