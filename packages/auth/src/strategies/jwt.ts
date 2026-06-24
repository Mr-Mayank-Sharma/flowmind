import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from "passport-jwt";
import { prisma } from "@flowmind/db";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId: string | null;
  tier: string;
  type: "access" | "refresh";
}

const options: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET ?? "fallback-secret-change-in-production",
  issuer: "flowmind",
  algorithms: ["HS256"],
};

export const jwtStrategy = new JwtStrategy(options, async (payload: JwtPayload, done) => {
  try {
    if (payload.type !== "access") {
      return done(null, false);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return done(null, false);
    }

    return done(null, {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      tier: user.tier,
    });
  } catch (err) {
    return done(err, false);
  }
});
