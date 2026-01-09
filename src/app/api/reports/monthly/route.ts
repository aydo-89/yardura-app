import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSignedUrl, getSupabaseAdmin } from "@/lib/supabase-admin";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Sanitize text for PDF WinAnsi encoding.
 * Replaces or removes characters that cannot be encoded in Windows-1252.
 */
function sanitizeForPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(/\u2011/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "*")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

async function generatePdf(params: {
  orgId: string;
  customerId?: string | null;
  month: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const draw = (text: string, x: number, y: number, size = 12) => {
    const safeText = sanitizeForPdf(text);
    page.drawText(safeText, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
  };

  draw("Yardura Monthly Report", 50, 740, 18);
  draw(`Org: ${params.orgId}`, 50, 720);
  draw(`Customer: ${params.customerId || "N/A"}`, 50, 704);
  draw(`Month: ${params.month}`, 50, 688);

  const samples = await prisma.sample.findMany({
    where: { orgId: params.orgId },
    orderBy: { capturedAt: "asc" },
    take: 30,
    include: { scores: true },
  });
  const weights = samples.map((s) => s.weightG || 0).filter(Boolean);
  const avgWeight = weights.length
    ? weights.reduce((a, b) => a + b, 0) / weights.length
    : 0;
  const alerts = await prisma.alert.findMany({
    where: { orgId: params.orgId },
  });

  draw(
    `Samples: ${samples.length}   Avg Weight: ${avgWeight.toFixed(1)} g   Alerts: ${alerts.length}`,
    50,
    672,
  );

  let y = 660;
  draw("Recent Samples:", 50, y);
  y -= 16;
  for (const s of samples) {
    const sc = s.scores[0];
    draw(
      `${s.capturedAt.toISOString()}  wt:${s.weightG ?? "-"}g  color:${sc?.colorLabel ?? "-"}  cons:${sc?.consistencyLabel ?? "-"}`,
      50,
      y,
    );
    y -= 14;
    if (y < 60) {
      y = 740;
      pdfDoc.addPage([612, 792]);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const customerId = searchParams.get("customerId");
  const month = searchParams.get("month"); // YYYY-MM
  if (!orgId || !month)
    return NextResponse.json(
      { error: "orgId and month required" },
      { status: 400 },
    );

  const pdf = await generatePdf({ orgId, customerId, month });
  const path = `reports/${orgId}/${customerId || "all"}/${month}.pdf`;
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.storage
    .from(process.env.STORAGE_BUCKET || "stool-samples")
    .upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  const url = await createSignedUrl(
    process.env.STORAGE_BUCKET || "stool-samples",
    path,
    3600,
  );
  return NextResponse.json({ url, path });
}

export const runtime = "nodejs";
