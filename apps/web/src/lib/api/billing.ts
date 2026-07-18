import { tRPCQuery, tRPCMutation } from "./core"

export const billingApi = {
  getSubscription: () => tRPCQuery<any>("billing.getSubscription"),
  createCheckout: (input: { tier: string; orgId?: string }) =>
    tRPCMutation<{ url: string }>("billing.createCheckout", input),
  createPortalSession: () => tRPCMutation<{ url: string }>("billing.createPortalSession", {}),
  getUsage: () => tRPCQuery<any>("billing.getUsage"),
  getInvoices: () => tRPCQuery<any[]>("billing.getInvoices"),
}
