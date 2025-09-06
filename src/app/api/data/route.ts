import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '@/lib/env';

// Simple per-device rate limit (ingest-specific). In production use Redis.
const deviceRateStore = new Map<string, { count: number; resetTime: number }>();
const DEVICE_RATE_LIMIT = { max: 12, windowMs: 60 * 1000 }; // 12 requests/min per device

function checkDeviceRateLimit(deviceId: string) {
  const now = Date.now();
  const record = deviceRateStore.get(deviceId);
  if (!record || now > record.resetTime) {
    deviceRateStore.set(deviceId, { count: 1, resetTime: now + DEVICE_RATE_LIMIT.windowMs });
    return true;
  }
  if (record.count >= DEVICE_RATE_LIMIT.max) return false;
  record.count++;
  deviceRateStore.set(deviceId, record);
  return true;
}

const dataSchema = z.object({
  deviceId: z.string().min(1),
  accountNumber: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  volume: z.union([z.string(), z.number()]).optional(),
  color: z.string().optional(),
  consistency: z.string().optional(),
  temperature: z.union([z.string(), z.number()]).optional(),
  methaneLevel: z.union([z.string(), z.number()]).optional(),
  location: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Verify JWT token
    const _decoded = jwt.verify(token, env.JWT_SIGNING_KEY || 'fallback-secret');

    const parsed = dataSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const {
      deviceId,
      accountNumber,
      weight,
      volume,
      color,
      consistency,
      temperature,
      methaneLevel,
      location,
    } = parsed.data;

    // Rate limit per device
    if (!checkDeviceRateLimit(deviceId)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Find user by account number if provided
    let userId = null;
    if (accountNumber) {
      const serviceVisit = await prisma.serviceVisit.findFirst({
        where: { accountNumber },
        orderBy: { createdAt: 'desc' },
      });
      userId = serviceVisit?.userId;
    }

    // Create data reading
    const dataReading = await prisma.dataReading.create({
      data: {
        deviceId,
        accountNumber,
        userId,
        weight: typeof weight === 'string' ? parseFloat(weight) : typeof weight === 'number' ? weight : null,
        volume: typeof volume === 'string' ? parseFloat(volume) : typeof volume === 'number' ? volume : null,
        color,
        consistency,
        temperature:
          typeof temperature === 'string'
            ? parseFloat(temperature)
            : typeof temperature === 'number'
            ? temperature
            : null,
        methaneLevel:
          typeof methaneLevel === 'string'
            ? parseFloat(methaneLevel)
            : typeof methaneLevel === 'number'
            ? methaneLevel
            : null,
        location,
      },
    });

    // Update global stats if this is anonymous data
    if (!accountNumber) {
      const globalStats = await prisma.globalStats.findUnique({
        where: { id: 'global' },
      });

      const weightNumber =
        typeof weight === 'string' ? parseFloat(weight) : typeof weight === 'number' ? weight : null;

      if (globalStats && typeof weightNumber === 'number' && !Number.isNaN(weightNumber)) {
        await prisma.globalStats.update({
          where: { id: 'global' },
          data: {
            totalWasteDiverted: {
              increment: weightNumber * 0.00220462, // Convert grams to lbs
            },
            totalServiceVisits: {
              increment: 1,
            },
          },
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        dataReadingId: dataReading.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving data reading:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
