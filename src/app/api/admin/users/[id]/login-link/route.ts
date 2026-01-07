import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractUserRole } from "@/lib/auth/roles";
import { createMagicLink } from "@/lib/auth/magicLink";
import { sendTransactionalEmail } from "@/lib/email";
import { buildInviteEmail } from "@/lib/email/templates";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  SALES_REP: "Sales rep",
  TECH: "Field tech",
  CUSTOMER: "Customer",
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const role = extractUserRole(session);

    if (!session?.user || !role || !["ADMIN", "OWNER"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const magicLinkUrl = await createMagicLink({
      email: member.email,
      callbackUrl: "/dashboard",
    });

    const inviterName = session.user?.name || "The InsightScoop team";
    const recipientName = member.name || member.email.split("@")[0];
    const roles = member.roles && member.roles.length > 0 ? member.roles : [member.role];
    const roleLabel = roles.map((role) => ROLE_LABEL[role] ?? role).join(" + ");
    const subject = "Your InsightScoop login link";
    const { html, text } = buildInviteEmail(inviterName, recipientName, magicLinkUrl, roleLabel);

    await sendTransactionalEmail({
      to: member.email,
      subject,
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending login link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
