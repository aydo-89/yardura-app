import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address, city, zipCode, phone, name } = await request.json();

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        city: true,
        zipCode: true,
        phone: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user profile
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        address: address ?? existingUser.address,
        city: city ?? existingUser.city,
        zipCode: zipCode ?? existingUser.zipCode,
        phone: phone ?? existingUser.phone,
        name: name ?? existingUser.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        city: true,
        zipCode: true,
        phone: true,
      },
    });

    // Send signup notification email
    try {
      const shouldSendSignupEmail =
        Boolean(process.env.RESEND_API_KEY) &&
        !existingUser.address &&
        !existingUser.phone &&
        (address || phone);

      if (shouldSendSignupEmail) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const envTo =
          process.env.CONTACT_TO_EMAIL ||
          "ayden@yardura.com,austyn@yardura.com";
        const recipients = envTo
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        await resend.emails.send({
          from: "InsightScoop <notifications@yardura.com>",
          to: recipients,
          subject: "New InsightScoop Signup",
          text: `New user signup\n\nName: ${user.name || ""}\nEmail: ${user.email}\nPhone: ${user.phone || phone || ""}\nAddress: ${user.address || address || ""}, ${user.city || city || ""} ${user.zipCode || zipCode || ""}`,
        });
      }
    } catch (err) {
      console.error("Signup notification email failed", err);
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        dogs: true,
        serviceVisits: {
          orderBy: { scheduledDate: "desc" },
          take: 5,
        },
        dataReadings: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
