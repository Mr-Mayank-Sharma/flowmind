import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripe = vi.hoisted(() => ({
  invoices: { list: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));

vi.mock("stripe", () => {
  function StripeMock() {
    return mockStripe;
  }
  return { default: StripeMock };
});

vi.mock("@flowmind/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    notification: { create: vi.fn() },
  },
}));

import { BillingService } from "../index";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BillingService - getInvoices", () => {
  it("returns empty array when user has no stripeId", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      stripeId: null,
    } as any);

    const result = await BillingService.getInvoices("user-1");
    expect(result).toEqual([]);
    expect(mockStripe.invoices.list).not.toHaveBeenCalled();
  });

  it("returns real invoice data from Stripe", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      stripeId: "cus_test123",
    } as any);

    mockStripe.invoices.list.mockResolvedValue({
      data: [
        {
          id: "in_abc123",
          amount_due: 2000,
          currency: "usd",
          status: "paid",
          created: 1700000000,
          hosted_invoice_url: "https://invoice.stripe.com/in_abc123",
          invoice_pdf: "https://invoice.stripe.com/in_abc123/pdf",
        },
      ],
    });

    const result = await BillingService.getInvoices("user-1");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("in_abc123");
    expect(result[0]!.amount).toBe(2000);
    expect(result[0]!.currency).toBe("usd");
    expect(result[0]!.status).toBe("paid");
    expect(result[0]!.hostedUrl).toBe("https://invoice.stripe.com/in_abc123");
    expect(mockStripe.invoices.list).toHaveBeenCalledWith({
      customer: "cus_test123",
      limit: 50,
    });
  });
});

describe("BillingService - handleWebhook", () => {
  it("handles checkout.session.completed", async () => {
    const { prisma } = await import("@flowmind/db");

    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_test",
      status: "active",
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      cancel_at_period_end: false,
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    await BillingService.handleWebhook({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          metadata: { userId: "user-1", tier: "PRO" },
          customer: "cus_new",
          subscription: "sub_test",
        } as any,
      },
    });

    expect(prisma.subscription.upsert).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { stripeId: "cus_new" },
      }),
    );
  });

  it("handles customer.subscription.deleted", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    await BillingService.handleWebhook({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_test",
          metadata: { userId: "user-1" },
        } as any,
      },
    });

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        update: expect.objectContaining({ tier: "FREE" }),
      }),
    );
  });

  it("handles invoice.payment_failed", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-1",
      stripeId: "cus_test",
    } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    await BillingService.handleWebhook({
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_fail",
          customer: "cus_test",
          amount_due: 5000,
          due_date: 1700000000,
        } as any,
      },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: "PAYMENT_FAILED",
        }),
      }),
    );
  });
});
