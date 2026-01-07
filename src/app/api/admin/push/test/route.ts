import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { extractUserRole } from "@/lib/auth/roles";
import { sendPushToUsers } from "@/lib/notifications/push";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = extractUserRole(session);

  if (!session || !role || (role !== "ADMIN" && role !== "OWNER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Test notification";
  const message =
    typeof body?.body === "string" && body.body.trim()
      ? body.body.trim()
      : "This is a test push notification.";
  const channelId =
    typeof body?.channelId === "string" && body.channelId.trim()
      ? body.channelId.trim()
      : "default";
  const data =
    body?.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : undefined;

  const userIds: string[] = [];
  if (typeof body?.userId === "string" && body.userId.trim()) {
    userIds.push(body.userId.trim());
  } else if (Array.isArray(body?.userIds)) {
    body.userIds.forEach((id: unknown) => {
      if (typeof id === "string" && id.trim()) {
        userIds.push(id.trim());
      }
    });
  } else {
    const sessionUserId = (session.user as { id?: string } | undefined)?.id;
    if (sessionUserId) userIds.push(sessionUserId);
  }

  if (!userIds.length) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 422 });
  }

  const result = await sendPushToUsers(userIds, {
    title,
    body: message,
    data,
    channelId,
  });

  return NextResponse.json({ ok: true, ...result });
}

export const runtime = "nodejs";



