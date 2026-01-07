import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession, authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notes } = await request.json();
    const normalizedNotes =
      typeof notes === "string" ? notes.trim() : "";

    const lead = await prisma.lead.findFirst({
      where: { email: session.user.email },
      orderBy: [
        { convertedAt: "desc" },
        { submittedAt: "desc" },
      ],
    });

    if (!lead) {
      return NextResponse.json(
        { error: "No active service record found" },
        { status: 404 },
      );
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        specialInstructions: normalizedNotes.length ? normalizedNotes : null,
      },
      select: {
        id: true,
        specialInstructions: true,
      },
    });

    return NextResponse.json({ notes: updated.specialInstructions });
  } catch (error) {
    console.error("Error updating customer notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
