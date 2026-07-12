import { describe, it, expect, vi, beforeEach } from "vitest";
import { WhatsAppAdapter } from "../adapters/whatsapp";

const mockFetch = vi.fn();
global.fetch = mockFetch;

let adapter: WhatsAppAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  adapter = new WhatsAppAdapter("phone-id", "test-token", "v21.0");
});

describe("WhatsAppAdapter - media URL resolution", () => {
  it("resolves image media ID to a download URL via the Graph API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://cdn.fb.com/media/abc123" }),
    });

    const payload = {
      entry: [
        {
          id: "wam-id-1",
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "msg-1",
                    from: "15551234567",
                    type: "image",
                    image: { id: "media-abc", mime_type: "image/jpeg" },
                  },
                ],
                contacts: [{ wa_id: "15551234567", profile: { name: "Test" } }],
              },
            },
          ],
        },
      ],
    };

    const result = await adapter.handleUpdate(payload);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/media-abc",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.files).toHaveLength(1);
    expect(result!.files![0]!.url).toBe("https://cdn.fb.com/media/abc123");
    expect(result!.files![0]!.mimeType).toBe("image/jpeg");
  });

  it("returns empty file URL when media fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    const payload = {
      entry: [
        {
          id: "wam-id-2",
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "msg-2",
                    from: "15551234567",
                    type: "video",
                    video: { id: "media-xyz", mime_type: "video/mp4" },
                  },
                ],
                contacts: [{ wa_id: "15551234567" }],
              },
            },
          ],
        },
      ],
    };

    const result = await adapter.handleUpdate(payload);
    expect(result!.files![0]!.url).toBe("");
  });

  it("handles text-only messages without media", async () => {
    const payload = {
      entry: [
        {
          id: "wam-id-3",
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "msg-3",
                    from: "15551234567",
                    type: "text",
                    text: { body: "hello" },
                  },
                ],
                contacts: [{ wa_id: "15551234567" }],
              },
            },
          ],
        },
      ],
    };

    const result = await adapter.handleUpdate(payload);
    expect(result!.text).toBe("hello");
    expect(result!.files).toBeUndefined();
  });
});
