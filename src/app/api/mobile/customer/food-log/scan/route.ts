import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { env } from '@/lib/env';
import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { createSignedUrl, deleteFile, uploadImage } from '@/lib/supabase-admin';
import { getCustomerWellnessAccess, incrementWellnessUsage } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function inferExtension(contentType?: string) {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic')) return 'heic';
  if (contentType.includes('jpeg')) return 'jpg';
  return 'jpg';
}

const SCAN_SCHEMA = {
  name: 'FoodLabelScan',
  schema: {
    type: 'object',
    required: ['brand', 'productName', 'ingredients', 'confidence', 'type'],
    properties: {
      brand: { type: 'string', maxLength: 120 },
      productName: { type: 'string', maxLength: 200 },
      ingredients: { type: 'string', maxLength: 2000 },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      type: {
        type: 'string',
        enum: ['FOOD', 'TREAT', 'SUPPLEMENT', 'MEDICATION', 'UNKNOWN'],
      },
    },
    additionalProperties: false,
  },
} as const;

const DEFAULT_MODEL = process.env.WELLNESS_FOOD_SCAN_MODEL ?? 'gpt-5-mini';

function resolveOpenAiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? null;
}

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
  const canSetup = canSetupCustomer(payload.roles);

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, orgId: true },
  });

  if (!customer) {
    return canSetup
      ? buildCustomerSetupResponse(userId)
      : NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  if (access.usage.foodScansCount >= access.limits.foodScansPerMonth) {
    return NextResponse.json(
      {
        ok: false,
        error: 'limit_reached',
        message: 'Monthly food scan limit reached.',
        data: { usage: access.usage, limits: access.limits, tier: access.tier },
      },
      { status: 403 },
    );
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ ok: false, error: 'Image upload required.' }, { status: 422 });
  }

  const formData = await request.formData().catch(() => null);
  const fileEntry = formData?.get('image');
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Image upload required.' }, { status: 422 });
  }
  const modeEntry = formData?.get('mode');
  const mode =
    typeof modeEntry === 'string' && modeEntry.toUpperCase() === 'INGREDIENTS'
      ? 'INGREDIENTS'
      : 'LABEL';

  if (!env.STORAGE_BUCKET) {
    return NextResponse.json({ ok: false, error: 'Storage not configured.' }, { status: 500 });
  }

  const openAiKey = resolveOpenAiKey();
  if (!openAiKey) {
    return NextResponse.json({ ok: false, error: 'OpenAI key missing.' }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
  const extension = inferExtension(fileEntry.type);
  const objectId = randomUUID();
  const storagePath = `wellness/food-scan/${customer.orgId}/${customer.id}/${objectId}.${extension}`;
  await uploadImage(env.STORAGE_BUCKET, storagePath, fileBuffer, fileEntry.type);

  let signedUrl: string | null = null;
  try {
    signedUrl = await createSignedUrl(env.STORAGE_BUCKET, storagePath, 60 * 10);
    const client = new OpenAI({ apiKey: openAiKey });
    const systemPrompt = [
      'You extract structured pet food label data for quick logging.',
      'Only return what is visible in the photo. Do not guess.',
      'If a field is missing, return an empty string.',
      'Classify the item type as FOOD, TREAT, SUPPLEMENT, MEDICATION, or UNKNOWN.',
    ].join(' ');
    const instructions =
      mode === 'INGREDIENTS'
        ? 'Extract the ingredients list. Leave brand and productName empty if not visible. Set type to UNKNOWN.'
        : 'Extract brand, product name, ingredients if visible, and classify the type.';

    const response = await client.responses.create({
      model: DEFAULT_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: instructions },
            { type: 'input_image', image_url: signedUrl, detail: 'high' },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: SCAN_SCHEMA.name,
          schema: SCAN_SCHEMA.schema,
        },
      },
    } as any);

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error('Model returned no structured output');
    }

    const firstBrace = outputText.indexOf('{');
    const lastBrace = outputText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('Unable to parse model response as JSON');
    }

    const parsed = JSON.parse(outputText.slice(firstBrace, lastBrace + 1)) as {
      brand: string;
      productName: string;
      ingredients: string;
      confidence: number;
      type: string;
    };

    const cleanString = (value: string, max: number) => value.trim().slice(0, max);
    const rawType = typeof parsed.type === 'string' ? parsed.type.trim().toUpperCase() : '';
    const allowedTypes = ['FOOD', 'TREAT', 'SUPPLEMENT', 'MEDICATION', 'UNKNOWN'] as const;
    const resolvedType = allowedTypes.includes(rawType as (typeof allowedTypes)[number])
      ? (rawType as (typeof allowedTypes)[number])
      : 'UNKNOWN';

    await incrementWellnessUsage({
      customerId: customer.id,
      orgId: customer.orgId,
      foodScansDelta: 1,
    });

    return NextResponse.json({
      ok: true,
      data: {
        scan: {
          brand: cleanString(parsed.brand || '', 120) || null,
          productName: cleanString(parsed.productName || '', 200) || null,
          ingredients: cleanString(parsed.ingredients || '', 2000) || null,
          confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : null,
          type: resolvedType,
        },
      },
    });
  } catch (error) {
    console.error('[food-scan] failed', error);
    return NextResponse.json({ ok: false, error: 'Unable to scan food label.' }, { status: 500 });
  } finally {
    await deleteFile(env.STORAGE_BUCKET, storagePath).catch(() => null);
  }
}
