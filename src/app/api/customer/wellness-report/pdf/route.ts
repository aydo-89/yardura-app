import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedUrl } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function parseDaysParam(value: string | null) {
  const parsed = Number(value ?? 14);
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(Math.max(Math.floor(parsed), 3), 30);
}

async function fetchImageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  const arrayBuffer = await response.arrayBuffer();
  return { bytes: arrayBuffer, contentType };
}

export async function GET(request: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: { email?: string | null } }
    | null;

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, orgId: true, name: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dogId = searchParams.get("dogId");
  const days = parseDaysParam(searchParams.get("days"));

  const dog = dogId
    ? await prisma.dog.findFirst({
        where: { id: dogId, customerId: customer.id },
        select: { name: true, breed: true, age: true, weight: true },
      })
    : null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const latestReport = await prisma.weeklyWellnessReport.findFirst({
    where: {
      customerId: customer.id,
      ...(dogId ? { OR: [{ dogId }, { suspectedDogIds: { has: dogId } }] } : {}),
    },
    orderBy: { weekStart: "desc" },
  });

  const windowStart = latestReport?.weekStart ?? since;
  const windowEnd = latestReport?.weekEnd ?? new Date();

  const [ownerCaptures, proMedia, foodLogs] = await Promise.all([
    prisma.customerWellnessCapture.findMany({
      where: {
        customerId: customer.id,
        capturedAt: { gte: windowStart, lte: windowEnd },
        ...(dogId ? { OR: [{ dogId }, { suspectedDogIds: { has: dogId } }] } : {}),
      },
      orderBy: { capturedAt: "desc" },
      take: 4,
    }),
    prisma.serviceVisitMedia.findMany({
      where: {
        assetType: "INSIGHTSCOOP",
        analysisStatus: { in: ["COMPLETED", "NEEDS_REVIEW"] },
        visibilityState: "VISIBLE",
        capturedAt: { gte: windowStart, lte: windowEnd },
        serviceVisit: { customerId: customer.id },
      },
      orderBy: { capturedAt: "desc" },
      take: 4,
    }),
    prisma.customerFoodLog.findMany({
      where: {
        customerId: customer.id,
        loggedAt: { gte: windowStart, lte: windowEnd },
        ...(dogId ? { dogId } : {}),
      },
      orderBy: { loggedAt: "desc" },
      take: 4,
    }),
  ]);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const drawText = (text: string, x: number, y: number, size = 12, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(text, { x, y, size, font, color });
  };

  drawText("Wellness Report", 50, 750, 20);
  drawText(`Customer: ${customer.name ?? "Owner"}`, 50, 728, 12, rgb(0.3, 0.3, 0.3));
  drawText(`Date: ${new Date().toLocaleDateString()}`, 50, 712, 12, rgb(0.3, 0.3, 0.3));

  if (dog) {
    drawText(
      `Dog: ${dog.name}${dog.breed ? ` · ${dog.breed}` : ""}${
        typeof dog.age === "number" ? ` · ${dog.age} yrs` : ""
      }${typeof dog.weight === "number" ? ` · ${dog.weight} lbs` : ""}`,
      50,
      690,
      12,
      rgb(0.2, 0.2, 0.2),
    );
  } else {
    drawText("Scope: Household summary", 50, 690, 12, rgb(0.2, 0.2, 0.2));
  }

  let cursorY = 660;
  drawText("Recent symptoms & notes", 50, cursorY, 14);
  cursorY -= 18;

  const symptomLines: string[] = [];
  if (latestReport) {
    if (latestReport.symptomTags.length) {
      symptomLines.push(`Weekly tags: ${latestReport.symptomTags.join(", ")}`);
    }
    if (latestReport.behaviorNotes) symptomLines.push(`Behavior: ${latestReport.behaviorNotes}`);
    if (latestReport.stoolNotes) symptomLines.push(`Stool notes: ${latestReport.stoolNotes}`);
  }
  if (latestReport) {
    if (latestReport.vomiting) symptomLines.push("Vomiting reported this week");
    if (latestReport.diarrhea) symptomLines.push("Diarrhea reported this week");
    if (typeof latestReport.stoolFrequency === "number") {
      symptomLines.push(`Stool frequency: ${latestReport.stoolFrequency} per day`);
    }
  }
  if (symptomLines.length === 0) {
    symptomLines.push("No concerning symptoms reported recently.");
  }

  symptomLines.slice(0, 5).forEach((line) => {
    drawText(`• ${line}`, 50, cursorY, 11, rgb(0.2, 0.2, 0.2));
    cursorY -= 14;
  });

  cursorY -= 6;
  drawText("Recent stool observations", 50, cursorY, 14);
  cursorY -= 18;

  if (latestReport) {
    drawText(
      `Colors: ${latestReport.stoolColors.join(", ") || "None"} · Consistency: ${
        latestReport.stoolConsistency.join(", ") || "None"
      } · Content: ${latestReport.stoolContents.join(", ") || "None"}`,
      50,
      cursorY,
      11,
      rgb(0.2, 0.2, 0.2),
    );
  } else {
    drawText("No weekly report available yet.", 50, cursorY, 11, rgb(0.4, 0.4, 0.4));
  }

  cursorY -= 10;
  drawText("Weekly recap & care timeline", 50, cursorY, 14);
  cursorY -= 18;

  const timelineLines: string[] = [];
  if (latestReport?.medsGiven) {
    timelineLines.push("Meds given this week");
  }
  if (latestReport?.medsNotes) {
    timelineLines.push(`Meds notes: ${latestReport.medsNotes}`);
  }
  if (latestReport?.appetite) {
    timelineLines.push(`Appetite: ${latestReport.appetite.toLowerCase()}`);
  }
  if (latestReport?.energy) {
    timelineLines.push(`Energy: ${latestReport.energy.toLowerCase()}`);
  }
  if (latestReport?.hydration) {
    timelineLines.push(`Water intake: ${latestReport.hydration.toLowerCase()}`);
  }
  if (foodLogs.length > 0) {
    const log = foodLogs[0];
    const name = [log.brand, log.productName].filter(Boolean).join(" ");
    timelineLines.push(`Diet log: ${name || "New food/treat logged"}`);
  }
  if (timelineLines.length === 0) {
    timelineLines.push("No weekly recap recorded during this window.");
  }

  timelineLines.slice(0, 4).forEach((line) => {
    drawText(`• ${line}`, 50, cursorY, 11, rgb(0.2, 0.2, 0.2));
    cursorY -= 14;
  });

  const imageSlots = [
    { x: 50, y: 190, w: 240, h: 160 },
    { x: 320, y: 190, w: 240, h: 160 },
    { x: 50, y: 20, w: 240, h: 160 },
    { x: 320, y: 20, w: 240, h: 160 },
  ];

  const imagesToUse = [...ownerCaptures, ...proMedia].slice(0, imageSlots.length);
  if (env.STORAGE_BUCKET && imagesToUse.length > 0) {
    for (let i = 0; i < imagesToUse.length; i += 1) {
      const media = imagesToUse[i];
      const storagePath = "storagePath" in media ? media.storagePath : null;
      if (!storagePath) continue;
      const signedUrl = await createSignedUrl(env.STORAGE_BUCKET, storagePath, 60 * 10);
      if (!signedUrl) continue;
      const imageData = await fetchImageBytes(signedUrl);
      if (!imageData) continue;
      try {
        const embedded =
          imageData.contentType.includes("png")
            ? await pdfDoc.embedPng(imageData.bytes)
            : await pdfDoc.embedJpg(imageData.bytes);
        const slot = imageSlots[i];
        page.drawImage(embedded, {
          x: slot.x,
          y: slot.y,
          width: slot.w,
          height: slot.h,
        });
      } catch {
        // Skip any embed failures silently
      }
    }
  }

  drawText(
    "Not a diagnosis. Seek veterinary care for severe symptoms or worsening condition.",
    50,
    370,
    10,
    rgb(0.4, 0.4, 0.4),
  );

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wellness-report.pdf"`,
    },
  });
}

export const runtime = "nodejs";
