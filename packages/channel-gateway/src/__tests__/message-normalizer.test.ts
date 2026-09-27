import { describe, it, expect } from "vitest";
import { normalizeMessage } from "../message-normalizer";

describe("normalizeMessage - whatsapp (Graph API shape)", () => {
  const graphPayload = (msg: Record<string, unknown>) => ({
    entry: [
      {
        id: "wam-id-1",
        changes: [
          {
            value: {
              messages: [msg],
              contacts: [{ wa_id: "15551234567", profile: { name: "Test" } }],
              metadata: { phone_number_id: "phone-id-1" },
            },
          },
        ],
      },
    ],
  });

  it("normalizes a text message", () => {
    const result = normalizeMessage({
      body: graphPayload({
        id: "msg-1",
        from: "15551234567",
        type: "text",
        text: { body: "hello" },
      }),
      raw: {},
      channelType: "whatsapp",
    });

    expect(result).not.toBeNull();
    expect(result!.channelType).toBe("whatsapp");
    expect(result!.id).toBe("msg-1");
    expect(result!.channelId).toBe("15551234567");
    expect(result!.userId).toBe("15551234567");
    expect(result!.text).toBe("hello");
    expect(result!.files).toBeUndefined();
    expect(result!.voiceUrl).toBeUndefined();
    expect(result!.metadata).toMatchObject({ wamId: "wam-id-1" });
  });

  it("normalizes an image message with media metadata", () => {
    const result = normalizeMessage({
      body: graphPayload({
        id: "msg-2",
        from: "15551234567",
        type: "image",
        image: { id: "media-abc", mime_type: "image/jpeg" },
      }),
      raw: {},
      channelType: "whatsapp",
    });

    expect(result!.files).toHaveLength(1);
    expect(result!.files![0]!.mimeType).toBe("image/jpeg");
    expect(result!.files![0]!.name).toBe("media.image");
    expect(result!.files![0]!.url).toBe("");
  });

  it("normalizes an audio message into voiceUrl", () => {
    const result = normalizeMessage({
      body: graphPayload({
        id: "msg-3",
        from: "15551234567",
        type: "audio",
        audio: { id: "media-audio", mime_type: "audio/ogg; codecs=opus" },
      }),
      raw: {},
      channelType: "whatsapp",
    });

    expect(result!.voiceUrl).toBe("");
    expect(result!.files).toHaveLength(1);
  });

  it("returns null for non-message updates", () => {
    const result = normalizeMessage({
      body: {
        entry: [
          {
            changes: [
              {
                value: { statuses: [{ id: "status-1" }] },
              },
            ],
          },
        ],
      },
      raw: {},
      channelType: "whatsapp",
    });

    expect(result).toBeNull();
  });
});

describe("normalizeMessage - telegram", () => {
  it("normalizes a telegram update", () => {
    const result = normalizeMessage({
      body: {
        message_id: 42,
        chat: { id: 12345 },
        from: { id: 67890 },
        text: "ping",
        reply_to_message: { message_id: 7 },
      },
      raw: {},
      channelType: "telegram",
    });

    expect(result!.channelType).toBe("telegram");
    expect(result!.id).toBe("42");
    expect(result!.channelId).toBe("12345");
    expect(result!.userId).toBe("67890");
    expect(result!.text).toBe("ping");
    expect(result!.replyTo).toBe("7");
  });
});

describe("normalizeMessage - slack", () => {
  it("normalizes a slack event", () => {
    const result = normalizeMessage({
      body: {
        client_msg_id: "c-1",
        event_ts: "1700000000.000100",
        channel: "C123",
        user: "U456",
        text: "hi",
        files: [{ url_private: "https://files.slack.com/f", mimetype: "text/plain", name: "note.txt" }],
      },
      raw: {},
      channelType: "slack",
    });

    expect(result!.channelType).toBe("slack");
    expect(result!.channelId).toBe("C123");
    expect(result!.userId).toBe("U456");
    expect(result!.text).toBe("hi");
    expect(result!.files![0]!.url).toBe("https://files.slack.com/f");
  });
});

describe("normalizeMessage - discord", () => {
  it("normalizes a discord message", () => {
    const result = normalizeMessage({
      body: {
        id: "msg-d1",
        channel_id: "CH1",
        author: { id: "US1" },
        content: "yo",
        message_reference: { message_id: "parent-1" },
      },
      raw: {},
      channelType: "discord",
    });

    expect(result!.channelType).toBe("discord");
    expect(result!.channelId).toBe("CH1");
    expect(result!.userId).toBe("US1");
    expect(result!.text).toBe("yo");
    expect(result!.replyTo).toBe("parent-1");
  });
});

describe("normalizeMessage - unknown channel", () => {
  it("returns null for unhandled channel types", () => {
    const result = normalizeMessage({
      body: { hi: true },
      raw: {},
      channelType: "email",
    });

    expect(result).not.toBeNull();
    expect(result!.channelType).toBe("email");
  });
});