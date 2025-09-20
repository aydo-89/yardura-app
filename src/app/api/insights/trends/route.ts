import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const days = Math.max(1, Math.min(365, Number(sp.get("days") || 30)));
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
  const samples = await prisma.sample.findMany({
    where: { capturedAt: { gte: since } },
    orderBy: { capturedAt: "asc" },
    include: { scores: true },
    take: 300,
  });

  const data = samples.map((s) => ({
    ts: s.capturedAt.toISOString(),
    weightG: s.weightG ?? null,
    moistureRaw: s.moistureRaw ?? null,
    color: s.scores[0]?.colorLabel ?? null,
    consistency: s.scores[0]?.consistencyLabel ?? null,
    flags: s.scores[0]?.contentFlags ?? null,
  }));
  return NextResponse.json({ items: data });
}

export const runtime = "nodejs";
