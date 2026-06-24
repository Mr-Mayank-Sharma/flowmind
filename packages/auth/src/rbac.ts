import { OrgRole } from "@flowmind/shared";

export enum Permission {
  VIEW_PROJECTS = "VIEW_PROJECTS",
  CREATE_PROJECTS = "CREATE_PROJECTS",
  EDIT_PROJECTS = "EDIT_PROJECTS",
  DELETE_PROJECTS = "DELETE_PROJECTS",
  VIEW_PIPELINES = "VIEW_PIPELINES",
  CREATE_PIPELINES = "CREATE_PIPELINES",
  EDIT_PIPELINES = "EDIT_PIPELINES",
  DELETE_PIPELINES = "DELETE_PIPELINES",
  RUN_PIPELINES = "RUN_PIPELINES",
  MANAGE_SKILLS = "MANAGE_SKILLS",
  MANAGE_MEMORY = "MANAGE_MEMORY",
  MANAGE_CHANNELS = "MANAGE_CHANNELS",
  MANAGE_CRON = "MANAGE_CRON",
  MANAGE_MCP = "MANAGE_MCP",
  MANAGE_TEAM = "MANAGE_TEAM",
  MANAGE_BILLING = "MANAGE_BILLING",
  MANAGE_AUDIT_LOG = "MANAGE_AUDIT_LOG",
  VIEW_ANALYTICS = "VIEW_ANALYTICS",
  EXPORT_DATA = "EXPORT_DATA",
  MANAGE_API_KEYS = "MANAGE_API_KEYS",
  MANAGE_SSO = "MANAGE_SSO",
  MANAGE_INTEGRATIONS = "MANAGE_INTEGRATIONS",
}

export type RolePermissions = Record<OrgRole, Permission[]>;

const rolePermissions: RolePermissions = {
  [OrgRole.OWNER]: Object.values(Permission),
  [OrgRole.ADMIN]: [
    Permission.VIEW_PROJECTS,
    Permission.CREATE_PROJECTS,
    Permission.EDIT_PROJECTS,
    Permission.DELETE_PROJECTS,
    Permission.VIEW_PIPELINES,
    Permission.CREATE_PIPELINES,
    Permission.EDIT_PIPELINES,
    Permission.DELETE_PIPELINES,
    Permission.RUN_PIPELINES,
    Permission.MANAGE_SKILLS,
    Permission.MANAGE_MEMORY,
    Permission.MANAGE_CHANNELS,
    Permission.MANAGE_CRON,
    Permission.MANAGE_MCP,
    Permission.MANAGE_TEAM,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_API_KEYS,
    Permission.MANAGE_INTEGRATIONS,
  ],
  [OrgRole.MEMBER]: [
    Permission.VIEW_PROJECTS,
    Permission.CREATE_PROJECTS,
    Permission.EDIT_PROJECTS,
    Permission.VIEW_PIPELINES,
    Permission.CREATE_PIPELINES,
    Permission.EDIT_PIPELINES,
    Permission.RUN_PIPELINES,
    Permission.MANAGE_SKILLS,
    Permission.MANAGE_MEMORY,
  ],
  [OrgRole.VIEWER]: [
    Permission.VIEW_PROJECTS,
    Permission.VIEW_PIPELINES,
    Permission.RUN_PIPELINES,
  ],
};

export function getPermissions(role: OrgRole): Permission[] {
  return rolePermissions[role] ?? [];
}

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return getPermissions(role).includes(permission);
}

export function hasAllPermissions(role: OrgRole, permissions: Permission[]): boolean {
  const perms = getPermissions(role);
  return permissions.every((p) => perms.includes(p));
}

export function hasAnyPermission(role: OrgRole, permissions: Permission[]): boolean {
  const perms = getPermissions(role);
  return permissions.some((p) => perms.includes(p));
}

export function requireRole(minimumRole: OrgRole): (role: OrgRole) => boolean {
  const hierarchy: OrgRole[] = [
    OrgRole.VIEWER,
    OrgRole.MEMBER,
    OrgRole.ADMIN,
    OrgRole.OWNER,
  ];
  return (role: OrgRole): boolean => {
    const userIdx = hierarchy.indexOf(role);
    const minIdx = hierarchy.indexOf(minimumRole);
    return userIdx >= minIdx;
  };
}
