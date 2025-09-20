import { NextResponse } from "next/server";
import { hostname } from "os";

export async function GET() {
  return NextResponse.json({
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    hostname: hostname(),
    timestamp: new Date().toISOString(),
  });
}
