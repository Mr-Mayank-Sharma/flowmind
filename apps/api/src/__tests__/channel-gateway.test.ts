import { describe, it, expect, vi, afterEach } from "vitest";
import type { ChannelAdapter, OutgoingMessage } from "@flowmind/channel-gateway";

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "DISCORD_BOT_TOKEN",
  "DISCORD_APPLICATION_ID",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "OPENHUMAN_API_KEY",
] as const;

async function loadService(env: Record<string, string>) {
  vi.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  return await import("../services/channel-gateway");
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("channel-gateway service", () => {
  it("registers adapters from env", async () => {
    const mod = await loadService({
      TELEGRAM_BOT_TOKEN: "tg-token",
      SLACK_BOT_TOKEN: "slack-token",
      SLACK_SIGNING_SECRET: "slack-secret",
      DISCORD_BOT_TOKEN: "discord-token",
      DISCORD_APPLICATION_ID: "discord-app",
      WHATSAPP_PHONE_NUMBER_ID: "wa-phone",
      WHATSAPP_ACCESS_TOKEN: "wa-token",
      OPENHUMAN_API_KEY: "oh-key",
    });

    const gateway = mod.getChannelGateway();
    const channels = gateway.getRegisteredChannels();

    expect(channels).toContain("telegram");
    expect(channels).toContain("slack");
    expect(channels).toContain("discord");
    expect(channels).toContain("whatsapp");
    expect(channels).toContain("openhuman");
  });

  it("registers no adapters without env", async () => {
    const mod = await loadService({});
    const gateway = mod.getChannelGateway();
    expect(gateway.getRegisteredChannels()).toHaveLength(0);
  });

  it("delivers a reply through a fake adapter", async () => {
    const sent: OutgoingMessage[] = [];
    const fakeAdapter: ChannelAdapter = {
      channelType: "telegram",
      sendMessage: async (message) => {
        sent.push(message);
      },
    };

    const mod = await loadService({ TELEGRAM_BOT_TOKEN: "tg-token" });
    const gateway = mod.getChannelGateway();
    gateway.registerAdapter(fakeAdapter);

    await gateway.sendMessage("telegram", {
      channelId: "12345",
      userId: "67890",
      text: "reply text",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]!.channelId).toBe("12345");
    expect(sent[0]!.userId).toBe("67890");
    expect(sent[0]!.text).toBe("reply text");
  });

  it("setupChannelWebhooks registers telegram + openhuman webhooks", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true });

    const mod = await loadService({
      TELEGRAM_BOT_TOKEN: "tg-token",
      OPENHUMAN_API_KEY: "oh-key",
    });

    await mod.setupChannelWebhooks("https://example.com");

    const telegramCall = fetchMock.mock.calls.find(
      (call) => call[0] === "https://api.telegram.org/bottg-token/setWebhook",
    );
    expect(telegramCall).toBeDefined();

    const openhumanCall = fetchMock.mock.calls.find(
      (call) => call[0] === "https://api.openhuman.ai/v1/webhooks",
    );
    expect(openhumanCall).toBeDefined();
    expect(JSON.parse(openhumanCall![1]!.body as string)).toEqual({
      url: "https://example.com/trpc/webhooks.ingest",
      events: ["message", "conversation.created"],
    });
  });

  it("setupChannelWebhooks does not throw when webhook registration fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValue(new Error("network down"));

    const mod = await loadService({ TELEGRAM_BOT_TOKEN: "tg-token" });
    await expect(mod.setupChannelWebhooks("https://example.com")).resolves.toBeUndefined();
  });
});