import type { Session } from "next-auth";

export type AppUserRole = "CUSTOMER" | "SALES_REP" | "TECH" | "ADMIN" | "OWNER";

const ROLE_PRIORITY: AppUserRole[] = [
  "OWNER",
  "ADMIN",
  "SALES_REP",
  "TECH",
  "CUSTOMER",
];

export const ROLE_DISPLAY_NAME: Record<AppUserRole, string> = {
  CUSTOMER: "Customer",
  SALES_REP: "Sales Rep",
  TECH: "Service Tech",
  ADMIN: "Admin",
  OWNER: "Owner",
};

export const ROLE_HOME_ROUTE: Record<AppUserRole, string> = {
  CUSTOMER: "/dashboard",
  SALES_REP: "/admin/leads",
  TECH: "/field-tech",
  ADMIN: "/admin",
  OWNER: "/admin",
};

export const ADMIN_PORTAL_ROLES: AppUserRole[] = ["ADMIN", "OWNER"];
export const SALES_PORTAL_ROLES: AppUserRole[] = ["ADMIN", "OWNER", "SALES_REP"];
export const DISPATCH_PORTAL_ROLES: AppUserRole[] = [
  "ADMIN",
  "OWNER",
  "TECH",
  "SALES_REP",
];
export const FIELD_OPS_ROLES: AppUserRole[] = [
  "TECH",
  "ADMIN",
  "OWNER",
  "SALES_REP",
];

export function sortRoles(
  roles: Iterable<AppUserRole>,
): AppUserRole[] {
  const unique = Array.from(new Set(roles));
  unique.sort(
    (a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b),
  );
  return unique;
}

function normalizeRoles(raw: unknown): AppUserRole[] {
  const roles: AppUserRole[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const candidate = value.toUpperCase() as AppUserRole;
    if ((ROLE_PRIORITY as readonly string[]).includes(candidate)) {
      if (!roles.includes(candidate)) {
        roles.push(candidate);
      }
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(push);
  } else if (raw != null) {
    push(raw);
  }

  roles.sort(
    (a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b),
  );

  return roles;
}

export function extractUserRoles(
  session: Session | null | undefined,
): AppUserRole[] {
  const candidateSources = [
    (session as any)?.userRoles,
    (session as any)?.role,
    (session as any)?.userRole,
    (session?.user as any)?.roles,
    (session?.user as any)?.role,
  ];

  for (const source of candidateSources) {
    const roles = normalizeRoles(source);
    if (roles.length > 0) {
      return roles;
    }
  }

  return [];
}

export function extractUserRole(
  session: Session | null | undefined,
): AppUserRole | null {
  const roles = extractUserRoles(session);
  return roles.length > 0 ? roles[0] : null;
}

export function extractActiveRole(
  session: Session | null | undefined,
): AppUserRole | null {
  const preferred = (session as any)?.activeRole;
  const roles = extractUserRoles(session);
  if (preferred && roles.includes(preferred)) {
    return preferred;
  }
  return roles.length > 0 ? roles[0] : null;
}

export function hasRole(
  roles: ReadonlyArray<AppUserRole> | null | undefined,
  allowed: AppUserRole | AppUserRole[],
): boolean {
  if (!roles || roles.length === 0) return false;
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  return roles.some((role) => allowedList.includes(role));
}

export function getDefaultRedirectForRoles(
  roles: ReadonlyArray<AppUserRole>,
): string {
  const primary = roles[0];
  if (!primary) return "/dashboard";
  return ROLE_HOME_ROUTE[primary] ?? "/dashboard";
}

export function getDefaultRedirectForRole(role?: AppUserRole | null): string {
  if (!role) return "/dashboard";
  return ROLE_HOME_ROUTE[role] ?? "/dashboard";
}

export function roleIs(
  role: unknown,
  allowed: ReadonlyArray<AppUserRole>,
): role is AppUserRole {
  if (typeof role !== "string") return false;
  return (allowed as readonly string[]).includes(role);
}
