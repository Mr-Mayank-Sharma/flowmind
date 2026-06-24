import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export const authRouter = router({
  register: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await ctx.prisma.user.create({
        data: { email: input.email, passwordHash, name: input.name },
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      return { user: { id: user.id, email: user.email, name: user.name }, token, refreshToken };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED" });

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED" });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
      const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier },
        token,
        refreshToken,
      };
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier };
    }),
});
