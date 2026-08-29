import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    orgSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
    orgMember: { findUnique: vi.fn(), count: vi.fn() },
    session: { count: vi.fn() },
    pipeline: { count: vi.fn() },
    subscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
  BillingService: {
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    getUsageMetrics: vi.fn(),
    getInvoices: vi.fn(),
  },
}));

vi.mock("@flowmind/db", () => ({ prisma: mocks.prisma }));
vi.mock("@flowmind/billing", () => ({ BillingService: mocks.BillingService }));

import { billingRouter } from "../routers/billing";

async function loadRouter() {
  vi.resetModules();
  const mod = await import("../routers/billing");
  return mod.billingRouter;
}

function makeCtx() {
  return {
    prisma: mocks.prisma,
    userId: "user-1",
    hostClient: null,
    req: { method: "POST", headers: {} },
    res: {},
  } as never as Parameters<typeof billingRouter.createCaller>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ENABLE_DEV_BILLING_MOCK;
  process.env.NODE_ENV = "test";

  mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-1", tier: "FREE", orgId: null, role: "USER" });
  mocks.prisma.orgSubscription.findUnique.mockResolvedValue(null);
  mocks.prisma.session.count.mockResolvedValue(0);
  mocks.prisma.pipeline.count.mockResolvedValue(0);
  mocks.prisma.subscription.findUnique.mockResolvedValue(null);
  mocks.prisma.subscription.upsert.mockResolvedValue({ id: "sub-1", userId: "user-1", tier: "PRO" });
  mocks.prisma.orgMember.findUnique.mockResolvedValue(null);
  mocks.prisma.orgMember.count.mockResolvedValue(0);
});

describe("billingRouter.createCheckout", () => {
  it("rejects with a clean error when Stripe is unconfigured and the mock is off", async () => {
    const router = await loadRouter();
    const caller = router.createCaller(makeCtx());

    let err: unknown;
    try {
      await caller.createCheckout({ tier: "PRO" });
    } catch (e) {
      err = e;
    }

    expect(err).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect((err as Error).message).toContain("Billing is not configured");
    expect(mocks.prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(mocks.BillingService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns a mock success route and upgrades the subscription when the dev mock is enabled", async () => {
    process.env.ENABLE_DEV_BILLING_MOCK = "true";

    const router = await loadRouter();
    const caller = router.createCaller(makeCtx());

    const result = await caller.createCheckout({ tier: "PRO" });

    expect(result).toEqual({ url: "/settings/billing?success=1", mock: true });
    expect(mocks.prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ userId: "user-1", tier: "PRO" }) }),
    );
    expect(mocks.BillingService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("never enables the mock in production", async () => {
    process.env.ENABLE_DEV_BILLING_MOCK = "true";
    process.env.NODE_ENV = "production";

    const router = await loadRouter();
    const caller = router.createCaller(makeCtx());

    let err: unknown;
    try {
      await caller.createCheckout({ tier: "PRO" });
    } catch (e) {
      err = e;
    }

    expect(err).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect((err as Error).message).toContain("Billing is not configured");
    expect(mocks.prisma.subscription.upsert).not.toHaveBeenCalled();
  });
});

describe("billingRouter.getSubscription", () => {
  it("returns a FREE default when no subscription exists", async () => {
    const router = await loadRouter();
    const caller = router.createCaller(makeCtx());

    const result = await caller.getSubscription();

    expect(result).toEqual({ tier: "FREE", status: "active", currentPeriodEnd: null });
    expect(mocks.prisma.subscription.findUnique).toHaveBeenCalledTimes(1);
  });
});