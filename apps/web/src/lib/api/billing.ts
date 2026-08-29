import { tRPCQuery, tRPCMutation } from "./core"

export const billingApi = {
  getSubscription: () => tRPCQuery<any>("billing.getSubscription"),
  createCheckout: (input: { tier: string; orgId?: string }) =>
    tRPCMutation<{ url: string; mock?: boolean }>("billing.createCheckout", input),
  createPortalSession: () => tRPCMutation<{ url: string }>("billing.createPortalSession", {}),
  getUsage: () => tRPCQuery<any>("billing.getUsage"),
  getInvoices: () => tRPCQuery<any[]>("billing.getInvoices"),
  getOrgSubscription: (orgId: string) => tRPCQuery<any>("billing.getOrgSubscription", { orgId }),
  createOrgCheckout: (input: { orgId: string; tier: string }) =>
    tRPCMutation<{ url: string; mock?: boolean }>("billing.createOrgCheckout", input),
  updateOrgMemberLimit: (input: { orgId: string; memberLimit: number }) =>
    tRPCMutation<any>("billing.updateOrgMemberLimit", input),
}
