import { Tier } from "@flowmind/shared";

export interface TierConfig {
  name: string;
  price: number | null;
  priceLabel: string;
  features: {
    chatsPerMonth: number | "unlimited";
    models: string[];
    pipelineNodes: number | "unlimited";
    cronJobs: number;
    channels: number;
    mcpConnections: number;
    storageGb: number;
    skills: number | "unlimited";
    memoryRetentionDays: number | "unlimited";
    ssoSaml: boolean;
    rbac: boolean;
    auditLogDays: number | null;
    sla: string | null;
    dedicatedCsm: boolean;
    teamSeatsIncluded: number | null;
    maxTeamSeats: number | null;
  };
}

export const tierConfigs: Record<Tier, TierConfig> = {
  [Tier.FREE]: {
    name: "Free",
    price: 0,
    priceLabel: "Free",
    features: {
      chatsPerMonth: 100,
      models: ["gpt-4o-mini", "local"],
      pipelineNodes: 50,
      cronJobs: 3,
      channels: 1,
      mcpConnections: 2,
      storageGb: 1,
      skills: 10,
      memoryRetentionDays: 30,
      ssoSaml: false,
      rbac: false,
      auditLogDays: null,
      sla: null,
      dedicatedCsm: false,
      teamSeatsIncluded: 1,
      maxTeamSeats: 1,
    },
  },
  [Tier.PRO]: {
    name: "Pro",
    price: 1900,
    priceLabel: "$19/mo",
    features: {
      chatsPerMonth: "unlimited",
      models: ["all-providers"],
      pipelineNodes: 500,
      cronJobs: 20,
      channels: 3,
      mcpConnections: 10,
      storageGb: 20,
      skills: 500,
      memoryRetentionDays: 365,
      ssoSaml: false,
      rbac: false,
      auditLogDays: null,
      sla: null,
      dedicatedCsm: false,
      teamSeatsIncluded: 1,
      maxTeamSeats: 1,
    },
  },
  [Tier.TEAM]: {
    name: "Team",
    price: 4900,
    priceLabel: "$49/seat/mo",
    features: {
      chatsPerMonth: "unlimited",
      models: ["all-providers"],
      pipelineNodes: "unlimited",
      cronJobs: "unlimited" as unknown as number,
      channels: "unlimited" as unknown as number,
      mcpConnections: "unlimited" as unknown as number,
      storageGb: "unlimited" as unknown as number,
      skills: "unlimited",
      memoryRetentionDays: "unlimited",
      ssoSaml: true,
      rbac: true,
      auditLogDays: 90,
      sla: null,
      dedicatedCsm: false,
      teamSeatsIncluded: 5,
      maxTeamSeats: null,
    },
  },
  [Tier.ENTERPRISE]: {
    name: "Enterprise",
    price: null,
    priceLabel: "Custom",
    features: {
      chatsPerMonth: "unlimited",
      models: ["all-providers"],
      pipelineNodes: "unlimited",
      cronJobs: "unlimited" as unknown as number,
      channels: "unlimited" as unknown as number,
      mcpConnections: "unlimited" as unknown as number,
      storageGb: "unlimited" as unknown as number,
      skills: "unlimited",
      memoryRetentionDays: "unlimited",
      ssoSaml: true,
      rbac: true,
      auditLogDays: 365,
      sla: "99.99%",
      dedicatedCsm: true,
      teamSeatsIncluded: null,
      maxTeamSeats: null,
    },
  },
};

export function getTierConfig(tier: Tier): TierConfig {
  const config = tierConfigs[tier];
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  return config;
}

export function isFeatureUnlimited(value: number | "unlimited"): boolean {
  return value === "unlimited";
}

export function canUpgrade(currentTier: Tier, targetTier: Tier): boolean {
  const order: Tier[] = [Tier.FREE, Tier.PRO, Tier.TEAM, Tier.ENTERPRISE];
  const currentIdx = order.indexOf(currentTier);
  const targetIdx = order.indexOf(targetTier);
  return targetIdx > currentIdx;
}

export function getPriceInCents(tier: Tier): number | null {
  return tierConfigs[tier]?.price ?? null;
}

export function getStripePriceId(tier: Tier): string | null {
  const envKey = `STRIPE_PRICE_${tier}`;
  return process.env[envKey] ?? null;
}
