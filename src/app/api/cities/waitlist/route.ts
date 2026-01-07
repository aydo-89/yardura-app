/**
 * City Waitlist API
 * Handles waitlist signups and retrieval
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/geo/postgis";

const waitlistSignupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  placeId: z.string().min(1, "City is required"),
  cityName: z.string().min(1, "City name is required"),
  state: z.string().min(2).max(2, "State must be 2 characters"),
  population: z.number().nullable().optional(),
  source: z.string().default("city_page"),
});

// POST - Sign up for waitlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = waitlistSignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { email, phone, placeId, cityName, state, population, source } = parsed.data;

    // Get client info for spam prevention
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      request.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    // Check rate limiting - max 10 signups per IP per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSignups = await prisma.cityWaitlist.count({
      where: {
        ipAddress,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentSignups >= 10) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many signups. Please try again later." },
        { status: 429 }
      );
    }

    // Create or update waitlist entry (upsert)
    const entry = await prisma.cityWaitlist.upsert({
      where: {
        email_placeId: { email: email.toLowerCase(), placeId },
      },
      update: {
        phone: phone || undefined,
        source,
        userAgent,
      },
      create: {
        email: email.toLowerCase(),
        phone: phone || undefined,
        placeId,
        cityName,
        state: state.toUpperCase(),
        population,
        source,
        ipAddress,
        userAgent,
      },
    });

    // Get updated waitlist count for this city
    const waitlistCount = await prisma.cityWaitlist.count({
      where: { placeId },
    });

    return NextResponse.json({
      ok: true,
      message: `You're on the waitlist for ${cityName}!`,
      entry: {
        id: entry.id,
        cityName: entry.cityName,
        state: entry.state,
      },
      waitlistCount,
    });
  } catch (error: any) {
    console.error("[cities/waitlist] POST error:", error);

    // Handle unique constraint violation gracefully
    if (error?.code === "P2002") {
      return NextResponse.json({
        ok: true,
        message: "You're already on the waitlist for this city!",
        alreadySignedUp: true,
      });
    }

    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }
}

// GET - Get waitlist stats (for admin or public display)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get("placeId");
  const state = searchParams.get("state");
  const topN = parseInt(searchParams.get("top") || "10");

  try {
    if (placeId) {
      // Get count for specific city
      const count = await prisma.cityWaitlist.count({
        where: { placeId },
      });
      return NextResponse.json({ placeId, count });
    }

    if (state) {
      // Get top cities by waitlist in a state
      const topCities = await prisma.cityWaitlist.groupBy({
        by: ["placeId", "cityName", "state"],
        where: { state: state.toUpperCase() },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: topN,
      });

      return NextResponse.json({
        state: state.toUpperCase(),
        cities: topCities.map((c) => ({
          placeId: c.placeId,
          cityName: c.cityName,
          state: c.state,
          count: c._count.id,
        })),
      });
    }

    // Get overall top cities nationwide
    const topCities = await prisma.cityWaitlist.groupBy({
      by: ["placeId", "cityName", "state"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: topN,
    });

    // Get total signups
    const totalSignups = await prisma.cityWaitlist.count();

    // Get unique cities with signups
    const uniqueCities = await prisma.cityWaitlist.groupBy({
      by: ["placeId"],
      _count: { id: true },
    });

    return NextResponse.json({
      totalSignups,
      uniqueCities: uniqueCities.length,
      topCities: topCities.map((c) => ({
        placeId: c.placeId,
        cityName: c.cityName,
        state: c.state,
        count: c._count.id,
      })),
    });
  } catch (error) {
    console.error("[cities/waitlist] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get waitlist stats" },
      { status: 500 }
    );
  }
}

