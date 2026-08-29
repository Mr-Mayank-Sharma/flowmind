import { prisma } from "./index";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function bootstrap() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      "Bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD to create an admin user and org."
    );
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    console.log(`Bootstrap skipped: user ${adminEmail} already exists.`);
    return;
  }

  const orgName = process.env.ADMIN_ORG_NAME?.trim() || "My Org";
  const adminName = process.env.ADMIN_NAME?.trim() || null;
  const orgSlug = slugify(orgName);

  const org = await prisma.org.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: orgName, slug: orgSlug, tier: "FREE" },
  });

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "SUPER_ADMIN",
      orgId: org.id,
    },
  });

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: adminUser.id } },
    update: {},
    create: { orgId: org.id, userId: adminUser.id, role: "OWNER" },
  });

  console.log(`Bootstrapped admin ${adminEmail} for org ${orgName} (${orgSlug})`);
}

bootstrap()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });