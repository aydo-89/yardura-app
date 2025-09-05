import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { uploadImage, publicUrl } from '@/lib/supabase-admin';
import { addSampleScoreJob } from '@/lib/queue';

const ingestSchema = z.object({
  deviceKey: z.string().min(10),
  deviceId: z.string().min(1),
  orgId: z.string().min(1),
  customerId: z.string().optional(),
  jobId: z.string().optional(),
  dogId: z.string().optional(),
  capturedAt: z.string().optional(),
  weightG: z.coerce.number().optional(),
  moistureRaw: z.coerce.number().int().optional(),
  temperatureC: z.coerce.number().optional(),
  gpsLat: z.coerce.number().optional(),
  gpsLng: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const fields: Record<string, any> = {};
    for (const [k, v] of form.entries()) {
      if (k === 'image') continue;
      fields[k] = v as string;
    }
    const parsed = ingestSchema.safeParse(fields);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Validate device
    const device = await prisma.device.findUnique({ where: { id: data.deviceId } });
    if (!device || device.orgId !== data.orgId) {
      return NextResponse.json({ error: 'Invalid device or org' }, { status: 401 });
    }
    const ok = await bcrypt.compare(data.deviceKey, device.apiKeyHash);
    if (!ok) return NextResponse.json({ error: 'Invalid key' }, { status: 401 });

    // Handle image
    const file = form.get('image') as File | null;
    let imageUrl: string | undefined;
    const sampleId = crypto.randomUUID();
    if (file) {
      const arrayBuf = await file.arrayBuffer();
      const path = `${data.orgId}/${sampleId}.jpg`;
      await uploadImage(env.STORAGE_BUCKET!, path, arrayBuf, file.type || 'image/jpeg');
      imageUrl = publicUrl(env.STORAGE_BUCKET!, path);
    }

    // Insert sample
    const capturedAt = data.capturedAt ? new Date(data.capturedAt) : new Date();
    await prisma.sample.create({
      data: {
        id: sampleId,
        orgId: data.orgId,
        deviceId: data.deviceId,
        customerId: data.customerId,
        dogId: data.dogId,
        jobId: data.jobId,
        capturedAt,
        imageUrl,
        weightG: data.weightG,
        moistureRaw: data.moistureRaw,
        temperatureC: data.temperatureC,
        gpsLat: data.gpsLat,
        gpsLng: data.gpsLng,
        notes: data.notes,
      },
    });

    // Enqueue scoring
    await addSampleScoreJob({ sampleId });

    return NextResponse.json({ sampleId }, { status: 201 });
  } catch (e: any) {
    console.error('ingest error', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
