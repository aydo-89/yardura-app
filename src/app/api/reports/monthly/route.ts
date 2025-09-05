import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin, createSignedUrl, uploadImage } from '@/lib/supabase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function generatePdf(params: { orgId: string; customerId?: string | null; month: string }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const draw = (text: string, x: number, y: number, size = 12) => {
    page.drawText(text, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
  };

  draw('Yardura Monthly Report', 50, 740, 18);
  draw(`Org: ${params.orgId}`, 50, 720);
  draw(`Customer: ${params.customerId || 'N/A'}`, 50, 704);
  draw(`Month: ${params.month}`, 50, 688);

  const samples = await prisma.sample.findMany({
    where: { orgId: params.orgId },
    orderBy: { capturedAt: 'asc' },
    take: 30,
    include: { scores: true },
  });

  let y = 660;
  draw('Recent Samples:', 50, y);
  y -= 16;
  for (const s of samples) {
    const sc = s.scores[0];
    draw(`${s.capturedAt.toISOString()}  wt:${s.weightG ?? '-'}g  color:${sc?.colorLabel ?? '-'}  cons:${sc?.consistencyLabel ?? '-'}`, 50, y);
    y -= 14;
    if (y < 60) { y = 740; pdfDoc.addPage([612, 792]); }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const customerId = searchParams.get('customerId');
  const month = searchParams.get('month'); // YYYY-MM
  if (!orgId || !month) return NextResponse.json({ error: 'orgId and month required' }, { status: 400 });

  const pdf = await generatePdf({ orgId, customerId, month });
  const path = `reports/${orgId}/${customerId || 'all'}/${month}.pdf`;
  await supabaseAdmin.storage.from(process.env.STORAGE_BUCKET || 'stool-samples').upload(path, pdf, {
    contentType: 'application/pdf', upsert: true,
  });
  const url = await createSignedUrl(process.env.STORAGE_BUCKET || 'stool-samples', path, 3600);
  return NextResponse.json({ url, path });
}

export const runtime = 'nodejs';
