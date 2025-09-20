import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    // Verify JWT token (you'll need to implement proper device authentication)
    jwt.verify(token, process.env.JWT_SECRET || "fallback-secret") as any;

    const {
      deviceId,
      accountNumber,
      weight,
      volume,
      color,
      consistency,
      temperature,
      methaneLevel,
      location,
    } = await request.json();

    // Find user by account number if provided
    let userId = null;
    if (accountNumber) {
      const serviceVisit = await prisma.serviceVisit.findFirst({
        where: { accountNumber },
        orderBy: { createdAt: "desc" },
      });
      userId = serviceVisit?.userId;
    }

    // Create data reading
    const dataReading = await prisma.dataReading.create({
      data: {
        deviceId,
        accountNumber,
        userId,
        weight: weight ? parseFloat(weight) : null,
        volume: volume ? parseFloat(volume) : null,
        color,
        consistency,
        temperature: temperature ? parseFloat(temperature) : null,
        methaneLevel: methaneLevel ? parseFloat(methaneLevel) : null,
        location,
      },
    });

    // Update global stats if this is anonymous data
    if (!accountNumber) {
      const globalStats = await prisma.globalStats.findUnique({
        where: { id: "global" },
      });

      if (globalStats && weight) {
        await prisma.globalStats.update({
          where: { id: "global" },
          data: {
            totalWasteDiverted: {
              increment: parseFloat(weight) * 0.00220462, // Convert grams to lbs
            },
            totalServiceVisits: {
              increment: 1,
            },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      dataReadingId: dataReading.id,
    });
  } catch (error) {
    console.error("Error saving data reading:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
