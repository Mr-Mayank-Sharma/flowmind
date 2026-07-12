import Stripe from "stripe";
import { prisma } from "@flowmind/db";
import { Tier } from "@flowmind/shared";
import { getTierConfig, canUpgrade } from "./tiers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-04-10",
  typescript: true,
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export interface CheckoutSessionInput {
  userId: string;
  tier: Tier;
  orgId?: string;
  quantity?: number;
}

async function createCheckoutSession(input: CheckoutSessionInput): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const currentSubscription = await prisma.subscription.findUnique({
    where: { userId: input.userId },
  });

  if (currentSubscription && !canUpgrade(currentSubscription.tier as unknown as Tier, input.tier)) {
    throw new Error("Cannot downgrade via checkout. Use customer portal instead.");
  }

  const tierConfig = getTierConfig(input.tier);
  if (!tierConfig.price) {
    throw new Error("Enterprise tier requires custom pricing. Contact sales.");
  }

  const priceEnvKey = `STRIPE_PRICE_${input.tier}`;
  const priceId = process.env[priceEnvKey];
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for ${input.tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: input.quantity ?? 1,
      },
    ],
    customer: user.stripeId ?? undefined,
    customer_email: user.stripeId ? undefined : user.email,
    client_reference_id: input.userId,
    metadata: {
      userId: input.userId,
      tier: input.tier,
      orgId: input.orgId ?? "",
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        tier: input.tier,
        orgId: input.orgId ?? "",
      },
    },
    success_url: `${process.env.APP_URL ?? "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL ?? "http://localhost:3000"}/billing/cancel`,
  });

  return session.url ?? "";
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

async function handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
  const event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  await handleWebhook(event as unknown as StripeWebhookEvent);
}

async function handleWebhook(event: StripeWebhookEvent): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier as Tier | undefined;

      if (userId && tier && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription({
          id: subscription.id,
          userId,
          tier,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        if (session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeId: session.customer as string },
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const tier = subscription.metadata?.tier as Tier | undefined;

      if (userId && tier) {
        await syncSubscription({
          id: subscription.id,
          userId,
          tier,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (userId) {
        await downgradeToFree({
          id: subscription.id,
          userId,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Stripe.Invoice;
      await notifyPaymentFailed({
        id: invoice.id,
        customer: invoice.customer as string,
        amountDue: invoice.amount_due,
        dueDate: new Date((invoice.due_date ?? Math.floor(Date.now() / 1000)) * 1000),
      });
      break;
    }

    default:
      break;
  }
}

export interface SubscriptionData {
  id: string;
  userId: string;
  tier: Tier;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

async function syncSubscription(data: SubscriptionData): Promise<void> {
  const tier = data.tier;
  await prisma.subscription.upsert({
    where: { userId: data.userId },
    update: {
      stripeId: data.id,
      tier,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    },
    create: {
      userId: data.userId,
      stripeId: data.id,
      tier,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    },
  });

  await prisma.user.update({
    where: { id: data.userId },
    data: { tier },
  });
}

export interface DowngradeInput {
  id: string;
  userId: string;
}

async function downgradeToFree(input: DowngradeInput): Promise<void> {
  await prisma.subscription.upsert({
    where: { userId: input.userId },
    update: {
      stripeId: input.id,
      tier: Tier.FREE,
      status: "canceled",
      cancelAtPeriodEnd: false,
    },
    create: {
      userId: input.userId,
      stripeId: input.id,
      tier: Tier.FREE,
      status: "canceled",
    },
  });

  await prisma.user.update({
    where: { id: input.userId },
    data: { tier: Tier.FREE },
  });
}

export interface PaymentFailedNotification {
  id: string;
  customer: string;
  amountDue: number;
  dueDate: Date;
}

async function notifyPaymentFailed(invoice: PaymentFailedNotification): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { stripeId: invoice.customer },
  });

  if (!user) return;

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "PAYMENT_FAILED",
      title: "Payment Failed",
      body: `Your payment of $${(invoice.amountDue / 100).toFixed(2)} failed. Please update your payment method.`,
      data: {
        invoiceId: invoice.id,
        amountDue: invoice.amountDue,
        dueDate: invoice.dueDate.toISOString(),
      },
    },
  });
}

export interface UsageMetrics {
  chatsUsed: number;
  chatLimit: number | "unlimited";
  storageUsedMb: number;
  storageLimitMb: number;
  pipelineCount: number;
  pipelineNodeLimit: number | "unlimited";
  cronJobCount: number;
  cronJobLimit: number;
  skillCount: number;
  skillLimit: number | "unlimited";
  channelCount: number;
  channelLimit: number;
  mcpConnectionCount: number;
  mcpConnectionLimit: number;
}

async function getUsageMetrics(userId: string): Promise<UsageMetrics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sessions: {
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const config = getTierConfig(user.tier as unknown as Tier);

  const chatsUsed = user.sessions.length;
  const pipelineCount = await prisma.pipeline.count({ where: { userId } });
  const cronJobCount = await prisma.cronJob.count({ where: { userId } });
  const skillCount = await prisma.skill.count({ where: { userId } });
  const storageUsedMb = 0;

  return {
    chatsUsed,
    chatLimit: config.features.chatsPerMonth,
    storageUsedMb,
    storageLimitMb: config.features.storageGb * 1024,
    pipelineCount,
    pipelineNodeLimit: config.features.pipelineNodes,
    cronJobCount,
    cronJobLimit: config.features.cronJobs,
    skillCount,
    skillLimit: config.features.skills,
    channelCount: 0,
    channelLimit: config.features.channels,
    mcpConnectionCount: 0,
    mcpConnectionLimit: config.features.mcpConnections,
  };
}

export interface TeamSeatInput {
  orgId: string;
  quantity: number;
}

async function createPortalSession(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (!user.stripeId) throw new Error("No Stripe customer ID");

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeId,
    return_url: `${process.env.APP_URL ?? "http://localhost:3000"}/settings/billing`,
  });

  return session.url;
}

async function manageTeamSeats(input: TeamSeatInput): Promise<void> {
  const org = await prisma.org.findUnique({
    where: { id: input.orgId },
    include: {
      members: true,
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: (await prisma.orgMember.findFirst({ where: { orgId: input.orgId, role: "OWNER" as never } }))?.userId ?? "" },
  });

  if (!subscription || !subscription.stripeId) {
    throw new Error("No active subscription found for this organization");
  }

  const currentMemberCount = org.members.length;
  const tierConfig = getTierConfig(org.tier as unknown as Tier);
  const maxSeats = tierConfig.features.maxTeamSeats;

  if (maxSeats !== null && input.quantity > maxSeats) {
    throw new Error(`Maximum ${maxSeats} seats allowed for ${org.tier} tier`);
  }

  if (input.quantity < currentMemberCount) {
    throw new Error(
      `Cannot reduce to ${input.quantity} seats; ${currentMemberCount} members currently assigned`,
    );
  }

  await stripe.subscriptions.update(subscription.stripeId, {
    items: [
      {
        quantity: input.quantity,
      },
    ],
  });
}

export const BillingService = {
  createCheckoutSession,
  createPortalSession,
  handleStripeWebhook,
  handleWebhook,
  syncSubscription,
  downgradeToFree,
  notifyPaymentFailed,
  getUsageMetrics,
  manageTeamSeats,
};
