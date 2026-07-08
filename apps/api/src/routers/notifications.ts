import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@flowmind.ai";

const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

export const notificationsRouter = router({
  sendEmail: protectedProcedure
    .input(z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      text: z.string().optional(),
      html: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!smtpConfigured) {
        await ctx.prisma.notification.create({
          data: {
            userId: ctx.userId,
            type: "EMAIL",
            title: input.subject,
            body: input.text || input.html || "",
            data: { to: input.to, smtpConfigured: false },
          },
        });
        return { queued: true, note: "SMTP not configured. Notification stored for later delivery." };
      }

      const res = await fetch(`http://${SMTP_HOST}:${SMTP_PORT}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: SMTP_FROM,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);

      await ctx.prisma.notification.create({
        data: {
          userId: ctx.userId,
          type: "EMAIL",
          title: input.subject,
          body: input.text || input.html || "",
          data: { to: input.to, sent: !!res, status: res?.status },
        },
      });

      return { sent: !!res, status: res?.status };
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.notification.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: { read: true },
      });
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.prisma.notification.updateMany({
        where: { userId: ctx.userId, read: false },
        data: { read: true },
      });
      return { success: true };
    }),
});
