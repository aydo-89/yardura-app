import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { env } from '../../../lib/env';
import { uploadImage } from '../../../lib/supabase-admin';
import { addSampleScoreJob, redis } from '../../../lib/queue';

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
    console.log('DATABASE_URL in API:', process.env.DATABASE_URL);
    console.log('Starting ingest request processing');

    const form = await req.formData();
    console.log('Form data received');
    const fields: Record<string, any> = {};

    // Handle form data entries manually for compatibility
    const formData = form as any;
    for (const [k, v] of formData.entries ? formData.entries() : []) {
      if (k === 'image') continue;
      fields[k] = v as string;
    }
    const parsed = ingestSchema.safeParse(fields);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Validate device
    console.log('Looking for device:', data.deviceId, 'orgId:', data.orgId);
    const device = await (prisma as any).device.findUnique({ where: { id: data.deviceId } });
    console.log('Found device:', device);
    if (!device || device.orgId !== data.orgId) {
      console.log('Device validation failed:', { device: !!device, orgMatch: device?.orgId === data.orgId });
      return NextResponse.json({ error: 'Invalid device or org' }, { status: 401 });
    }
    const ok = await bcrypt.compare(data.deviceKey, device.apiKeyHash);
    if (!ok) return NextResponse.json({ error: 'Invalid key' }, { status: 401 });

    // Basic rate limiting by device (disabled for testing)
    // const rlKey = `rl:ingest:${data.deviceId}`;
    // const count = await redis.incr(rlKey);
    // if (count === 1) {
    //   await redis.expire(rlKey, 10);
    // }
    // if (count > 20) {
    //   return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    // }

    // Handle image
    const file = form.get('image') as File | null;
    let imageUrl: string | undefined;
    let storagePath: string | undefined;
    const sampleId = crypto.randomUUID();
    if (file) {
      const arrayBuf = await file.arrayBuffer();
      storagePath = `${data.orgId}/${sampleId}.jpg`;
      await uploadImage(env.STORAGE_BUCKET!, storagePath, arrayBuf, file.type || 'image/jpeg');
    }

    // Insert sample
    const capturedAt = data.capturedAt ? new Date(data.capturedAt) : new Date();
    await (prisma as any).sample.create({
      data: {
        id: sampleId,
        orgId: data.orgId,
        deviceId: data.deviceId,
        customerId: data.customerId,
        dogId: data.dogId,
        jobId: data.jobId,
        capturedAt,
        imageUrl: storagePath,
        weightG: data.weightG,
        moistureRaw: data.moistureRaw,
        temperatureC: data.temperatureC,
        gpsLat: data.gpsLat,
        gpsLng: data.gpsLng,
        notes: data.notes,
      },
    });

    // Enqueue scoring
    console.log('About to enqueue scoring job...');
    await addSampleScoreJob({ sampleId });
    console.log('Scoring job enqueued successfully');

    return NextResponse.json({ sampleId }, { status: 201 });
  } catch (e: any) {
    console.error('ingest error:', e);
    console.error('Error message:', e?.message);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({
      error: 'server_error',
      message: e?.message || 'Unknown error',
      stack: e?.stack || 'No stack'
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
