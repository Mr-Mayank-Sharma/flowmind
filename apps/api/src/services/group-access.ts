import { prisma } from "@flowmind/db";

export async function userGroupRoles(userId: string): Promise<Map<string, string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true, org: { select: { members: { where: { userId }, select: { role: true } } } } },
  });
  const roles = new Map<string, string>();

  const memberships = await prisma.hostGroupMember.findMany({
    where: { userId },
    select: { groupId: true, role: true },
  });
  for (const m of memberships) roles.set(m.groupId, m.role);

  if (user?.orgId) {
    const orgRole = user.org?.members?.[0]?.role;
    if (orgRole === "OWNER" || orgRole === "ADMIN") {
      const groups = await prisma.hostGroup.findMany({
        where: { orgId: user.orgId },
        select: { id: true },
      });
      for (const g of groups) if (!roles.has(g.id)) roles.set(g.id, "OWNER");
    }
  }
  return roles;
}
