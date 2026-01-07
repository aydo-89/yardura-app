import type { NextRequest } from "next/server";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { FIELD_OPS_ROLES, extractUserRoles, hasRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";

export type ScooperAuth = {
  userId: string;
  orgId: string | null;
  userName: string | null;
  email: string | null;
  roles: string[];
  source: "session" | "token";
};

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function getScooperAuth(
  request: NextRequest,
): Promise<ScooperAuth | null> {
  const session = await safeGetServerSession(authOptions as any);
  const sessionUser = session?.user;

  if (sessionUser?.id) {
    const roles = extractUserRoles(session);
    if (!hasRole(roles, FIELD_OPS_ROLES)) {
      return null;
    }
    return {
      userId: sessionUser.id,
      orgId: sessionUser.orgId ?? null,
      userName: sessionUser.name ?? null,
      email: sessionUser.email ?? null,
      roles,
      source: "session",
    };
  }

  const token = getBearerToken(request);
  if (!token) return null;

  try {
    const payload = verifyMobileToken(token);
    if (!payload.sub) return null;
    if (!hasRole(payload.roles ?? [], FIELD_OPS_ROLES)) {
      return null;
    }

    let orgId = payload.orgId ?? null;
    let userName: string | null = null;
    let email: string | null = payload.email ?? null;

    if (!orgId || !userName) {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, orgId: true },
      });
      if (!user) return null;
      orgId = user.orgId ?? orgId;
      userName = user.name ?? null;
      email = user.email ?? email;
    }

    return {
      userId: payload.sub,
      orgId,
      userName,
      email,
      roles: payload.roles ?? [],
      source: "token",
    };
  } catch {
    return null;
  }
}
