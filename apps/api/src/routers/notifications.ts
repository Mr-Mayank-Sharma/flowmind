import { z } from "zod";
import { router, protectedProcedure } from "../middleware/trpc";
import { sendMail, smtpConfigured } from "../lib/mailer";

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
            userId: ctx.userId!,
            type: "EMAIL",
            title: input.subject,
            body: input.text || input.html || "",
            data: { to: input.to, smtpConfigured: false },
          },
        });
        return { queued: true, note: "SMTP not configured. Notification stored for later delivery." };
      }

      const sent = await sendMail({
        to: input.to,
        subject: input.subject,
        text: input.text || "",
        html: input.html,
      });

      await ctx.prisma.notification.create({
        data: {
          userId: ctx.userId!,
          type: "EMAIL",
          title: input.subject,
          body: input.text || input.html || "",
          data: { to: input.to, sent },
        },
      });

      return { sent };
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.notification.findMany({
        where: { userId: ctx.userId ?? undefined },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.userId ?? undefined },
        data: { read: true },
      });
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.prisma.notification.updateMany({
        where: { userId: ctx.userId ?? undefined, read: false },
        data: { read: true },
      });
      return { success: true };
    }),
});
