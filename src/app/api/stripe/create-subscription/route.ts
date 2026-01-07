import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "deprecated_endpoint",
      message:
        "Direct subscription creation has moved to the onboarding flow. Use /api/onboarding/complete instead.",
    },
    { status: 410 },
  );
}
