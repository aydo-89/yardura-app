import { NextRequest, NextResponse } from "next/server";
import { track, type EventType } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, properties, userId } = body;

    // Basic validation
    if (!event || typeof event !== "string") {
      return NextResponse.json(
        { error: "Invalid event name" },
        { status: 400 },
      );
    }

    // Track the event
    track(event as EventType, properties || {}, userId);

    return NextResponse.json({
      success: true,
      event,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 },
    );
  }
}

export async function GET() {
  // Health check for analytics endpoint
  return NextResponse.json({
    status: "ok",
    service: "analytics",
    timestamp: new Date().toISOString(),
  });
}
