import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { uploadImage, createSignedUrl } from '@/lib/supabase-admin';
import { resolveStorageUrl } from '@/lib/storage';
import { env } from '@/lib/env';
import { analyzeVetDocument } from '@/lib/wellness/vet-document-analysis';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

// GET - List vet documents for customer
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dogId = searchParams.get('dogId');

  const documents = await prisma.customerVetDocument.findMany({
    where: {
      customerId: customer.id,
      ...(dogId ? { dogId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      dog: {
        select: { id: true, name: true },
      },
    },
  });

  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      documentUrl: await resolveStorageUrl(doc.documentUrl),
    })),
  );

  return NextResponse.json({
    ok: true,
    documents: documentsWithUrls,
  });
}

const uploadSchema = z.object({
  dogId: z.string().optional(),
  documentName: z.string().min(1).max(200),
  documentType: z.string().optional(),
  visitDate: z.string().datetime().optional(),
  veterinarian: z.string().max(200).optional(),
  clinic: z.string().max(200).optional(),
});

// POST - Upload new vet document
export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const metadata = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    let parsedMetadata: z.infer<typeof uploadSchema>;
    try {
      parsedMetadata = uploadSchema.parse(JSON.parse(metadata || '{}'));
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid metadata' }, { status: 400 });
    }

    // Validate file type (PDF only for now)
    const fileType = file.type;
    if (!fileType.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { ok: false, error: 'Only PDF documents are supported' },
        { status: 400 },
      );
    }

    // Validate storage bucket is configured
    const storageBucket = env.STORAGE_BUCKET;
    if (!storageBucket) {
      return NextResponse.json(
        { ok: false, error: 'Storage not configured' },
        { status: 500 },
      );
    }

    // Upload file to storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `vet-documents/${customer.orgId}/${customer.id}/${Date.now()}-${file.name}`;
    await uploadImage(storageBucket, storagePath, buffer, 'application/pdf');

    // Create document record
    const document = await prisma.customerVetDocument.create({
      data: {
        orgId: customer.orgId,
        customerId: customer.id,
        dogId: parsedMetadata.dogId || null,
        documentUrl: storagePath,
        documentName: parsedMetadata.documentName || file.name,
        documentType: parsedMetadata.documentType || null,
        visitDate: parsedMetadata.visitDate ? new Date(parsedMetadata.visitDate) : null,
        veterinarian: parsedMetadata.veterinarian || null,
        clinic: parsedMetadata.clinic || null,
        analysisStatus: 'PENDING',
      },
    });

    // Generate signed URL for AI analysis
    const signedUrl = await createSignedUrl(storageBucket, storagePath, 60 * 30);

    // Trigger async AI analysis (don't await) if signed URL is available
    if (signedUrl) {
      analyzeVetDocument(document.id, signedUrl).catch((error) => {
        console.error('Vet document analysis failed:', error);
      });
    }

    return NextResponse.json({
      ok: true,
      document: {
        ...document,
        documentUrl: await resolveStorageUrl(storagePath),
      },
    });
  } catch (error) {
    console.error('Vet document upload error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to upload document' },
      { status: 500 },
    );
  }
}
