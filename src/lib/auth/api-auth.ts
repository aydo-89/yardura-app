import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import type { AppUserRole } from "@/lib/auth/roles";
import { extractActiveRole, extractUserRoles } from "@/lib/auth/roles";
import { verifyMobileToken } from "@/lib/mobile-auth";

export type ApiAuthContext = {
  userId: string | null;
  orgId: string | null;
  role: AppUserRole | null;
  roles: AppUserRole[];
  source: "session" | "mobile";
};

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function resolveApiAuth(request: NextRequest): Promise<ApiAuthContext | null> {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const role = extractActiveRole(session);
    const roles = extractUserRoles(session);
    return {
      userId: (session.user as any)?.id ?? null,
      orgId: (session.user as any)?.orgId ?? null,
      role,
      roles,
      source: "session",
    };
  }

  const token = getBearerToken(request);
  if (!token) return null;

  try {
    const payload = verifyMobileToken(token);
    const roles = (payload.roles ?? []) as AppUserRole[];
    const role = payload.activeRole ?? roles[0] ?? null;
    return {
      userId: payload.sub ?? null,
      orgId: payload.orgId ?? null,
      role,
      roles,
      source: "mobile",
    };
  } catch {
    return null;
  }
}
