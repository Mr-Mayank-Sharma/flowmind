import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tRPCQuery, tRPCMutation, ApiError } from "@/lib/api/core";

class CookieJar {
  private cookies = new Map<string, string>();

  get cookie(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("; ");
  }

  set cookie(value: string) {
    const [pair] = value.split(";");
    if (!pair) return;
    const eq = pair.indexOf("=");
    if (eq === -1) return;
    const key = pair.slice(0, eq);
    const val = pair.slice(eq + 1);
    if (val === "") this.cookies.delete(key);
    else this.cookies.set(key, decodeURIComponent(val));
  }

  set(key: string, value: string) {
    this.cookies.set(key, value);
  }
}

const storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  const jar = new CookieJar();
  vi.stubGlobal(
    "document",
    {
      get cookie() {
        return jar.cookie;
      },
      set cookie(value: string) {
        jar.cookie = value;
      },
    },
  );
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tRPC error parsing", () => {
  it("extracts message and code from a nested tRPC error envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { json: { message: "Skill rejected", code: "BAD_REQUEST", data: { httpStatus: 400 } } },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const err = await tRPCMutation("skills.block", { skillId: "x" }).catch((e: Error) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe("Skill rejected");
    expect((err as ApiError).code).toBe("BAD_REQUEST");
    expect((err as ApiError).httpStatus).toBe(400);
  });

  it("falls back to a string envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const err = await tRPCQuery("system.metrics").catch((e: Error) => e);

    expect((err as ApiError).message).toBe("boom");
    expect((err as ApiError).code).toBe("ERROR");
    expect((err as ApiError).httpStatus).toBe(500);
  });
});

describe("tRPC 401 refresh flow", () => {
  it("refreshes the token once and retries the original request", async () => {
    document.cookie = "flowmind_token=old-token;path=/";
    document.cookie = "flowmind_refresh=refresh-token;path=/";

    let chatCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/trpc/auth.refresh")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                data: {
                  user: { id: "u1", email: "a@b.c", name: "A", role: "USER", tier: "FREE" },
                  token: "new-token",
                  refreshToken: "new-refresh",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/trpc/chat.getSessions")) {
        chatCalls++;
        if (chatCalls === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: "Expired" } }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ result: { data: { sessions: [], nextCursor: null } } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { message: "Expired" } }), { status: 401 }));
    });

    const result = await tRPCQuery("chat.getSessions", { limit: 10 });

    expect(result).toEqual({ sessions: [], nextCursor: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: { Authorization: "Bearer old-token" } });
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({ headers: { Authorization: "Bearer new-token" } });
    expect(storage.setItem).toHaveBeenCalledWith("flowmind_user", expect.any(String));
  });

  it("fails with a session-expired error when refresh also fails", async () => {
    document.cookie = "flowmind_token=old-token;path=/";
    document.cookie = "flowmind_refresh=refresh-token;path=/";

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/trpc/auth.refresh")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: "Invalid refresh token" } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { message: "Expired" } }), { status: 401 }));
    });

    const err = await tRPCQuery("chat.getSessions", { limit: 10 }).catch((e: Error) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toContain("Session expired");
    expect((err as ApiError).code).toBe("UNAUTHORIZED");
    expect((err as ApiError).httpStatus).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});