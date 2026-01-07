import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

import { buildCustomerSetupResponse, canSetupCustomer } from '@/lib/mobile/customer-setup';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { env } from '@/lib/env';
import { getCustomerWellnessAccess, incrementWellnessUsage } from '@/lib/wellness/access';
import { buildWellnessChatContext } from '@/lib/wellness/chat-context';
import {
  collectWellnessEmbeddingDocs,
  ensureWellnessEmbeddings,
  searchWellnessEmbeddings,
} from '@/lib/wellness/embedding-store';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  dogId: z.string().optional(),
  mode: z.enum(['reply', 'analysis']).optional(),
  reply: z.string().max(1200).optional(),
  context: z
    .object({
      symptoms: z.array(z.string()).optional(),
      recentNotes: z.string().optional(),
    })
    .optional(),
});

const CHAT_SCHEMA = {
  name: 'WellnessChatResponse',
  schema: {
    type: 'object',
    required: [
      'reply',
      'risk_level',
      'red_flags',
      'suggested_actions',
      'follow_up_questions',
      'disclaimer',
    ],
    properties: {
      reply: { type: 'string', maxLength: 700 },
      risk_level: { type: 'string', enum: ['watch', 'monitor', 'vet_now'] },
      red_flags: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 4 },
      suggested_actions: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 4 },
      follow_up_questions: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 3 },
      disclaimer: { type: 'string', maxLength: 180 },
      memory_update: { type: 'string', maxLength: 1200 },
    },
    additionalProperties: false,
  },
} as const;

function resolveOpenAiKey(): string | null {
  return (
    process.env.WELLNESS_CHAT_OPENAI_KEY ??
    process.env.OPENAI_API_KEY ??
    env.OPENAI_API_KEY ??
    null
  );
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

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  const mode = parsed.data.mode ?? 'analysis';
  if (access.usage.chatsCount >= access.limits.chatsPerMonth) {
    return NextResponse.json(
      {
        ok: false,
        error: 'limit_reached',
        message: 'Monthly chat limit reached.',
        data: { usage: access.usage, limits: access.limits, tier: access.tier },
      },
      { status: 403 },
    );
  }

  const includeFullContext = access.tier === 'PREMIUM';
  const timeZone = request.headers.get('x-time-zone');
  const { context } = await buildWellnessChatContext({
    customerId: customer.id,
    orgId: customer.orgId,
    dogId: parsed.data.dogId ?? null,
    includeFullContext,
    timeZone,
  });
  let semanticHighlights: Awaited<ReturnType<typeof searchWellnessEmbeddings>> | null = null;
  if (includeFullContext) {
    try {
      const docs = await collectWellnessEmbeddingDocs({
        customerId: customer.id,
        orgId: customer.orgId,
        dogId: parsed.data.dogId ?? null,
      });
      await ensureWellnessEmbeddings({ docs, maxDocs: 24 });
      semanticHighlights = await searchWellnessEmbeddings({
        customerId: customer.id,
        dogId: parsed.data.dogId ?? null,
        query: parsed.data.message,
        limit: 6,
      });
    } catch (error) {
      console.warn('[wellness-chat] semantic search failed', error);
      semanticHighlights = null;
    }
  }

  const openAiKey = resolveOpenAiKey();
  if (!openAiKey) {
    return NextResponse.json(
      { ok: false, error: 'AI not configured' },
      { status: 500 },
    );
  }

  const client = new OpenAI({ apiKey: openAiKey });

  const systemPrompt =
    mode === 'reply'
      ? [
          'You are InsightScoop, a calm and concise wellness + account assistant for dog owners.',
          'Use the provided context JSON for facts about pets, logs, service schedule, and plans.',
          'If semanticHighlights exist, prioritize them for relevant recall.',
          'Do not diagnose or prescribe; encourage vet care for urgent symptoms.',
          'If asked about account or service, answer using context and suggest the next in-app step.',
          'Keep replies short, friendly, and easy to skim.',
        ].join(' ')
      : [
          'You are an AI wellness analyst for dog owners.',
          'Return JSON that matches the schema.',
          'Use watch for mild, monitor for moderate, vet_now for urgent symptoms.',
          'If the question is about account/service, keep risk_level at watch unless red flags exist.',
          'If assistant_reply is provided, use it verbatim for reply.',
          'If semanticHighlights exist, cite them for context in suggested actions.',
          'Ask follow-up questions when key details are missing.',
          'Never diagnose or prescribe. Always include a short disclaimer.',
          'If possible, write memory_update as a short, stable summary without sensitive data.',
        ].join(' ');

  const userPrompt = [
    `User message: ${parsed.data.message}`,
    parsed.data.context?.symptoms?.length
      ? `\nSymptoms: ${parsed.data.context.symptoms.join(', ')}`
      : '',
    parsed.data.context?.recentNotes ? `\nNotes: ${parsed.data.context.recentNotes}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const contextPayload = {
    ...context,
    wellnessAccess: {
      tier: access.tier,
      source: access.source,
      planEndsAt: access.planEndsAt ? access.planEndsAt.toISOString() : null,
      hasActiveService: access.hasActiveService,
      promoEligible: access.promoEligible,
    },
    semanticHighlights,
  };
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: `Context JSON:\n${JSON.stringify(contextPayload)}` },
  ];

  if (mode === 'analysis' && parsed.data.reply) {
    messages.push({
      role: 'assistant',
      content: `assistant_reply: ${parsed.data.reply}`,
    });
  }

  messages.push({ role: 'user', content: userPrompt });

  const response =
    mode === 'reply'
      ? await client.responses.create({
          model: process.env.WELLNESS_CHAT_REPLY_MODEL ?? process.env.WELLNESS_CHAT_MODEL ?? 'gpt-5-mini',
          input: messages,
        } as any)
      : await client.responses.create({
          model: process.env.WELLNESS_CHAT_MODEL ?? 'gpt-5-mini',
          input: messages,
          text: {
            format: {
              type: 'json_schema',
              name: CHAT_SCHEMA.name,
              schema: CHAT_SCHEMA.schema,
            },
          },
        } as any);

  const outputText = response.output_text?.trim();
  if (!outputText) {
    return NextResponse.json({ ok: false, error: 'AI response missing' }, { status: 502 });
  }

  if (mode === 'reply') {
    return NextResponse.json({
      ok: true,
      data: { reply: outputText },
    });
  }

  const firstBrace = outputText.indexOf('{');
  const lastBrace = outputText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    return NextResponse.json({ ok: false, error: 'AI response invalid' }, { status: 502 });
  }

  const payloadJson = JSON.parse(outputText.slice(firstBrace, lastBrace + 1));
  if (parsed.data.reply) {
    payloadJson.reply = parsed.data.reply;
  }

  const memoryUpdate =
    includeFullContext && typeof payloadJson.memory_update === 'string'
      ? payloadJson.memory_update.trim()
      : null;

  if (memoryUpdate) {
    const key = parsed.data.dogId ? `dog:${parsed.data.dogId}` : 'household';
    await prisma.customerWellnessMemory.upsert({
      where: {
        customerId_key: {
          customerId: customer.id,
          key,
        },
      },
      create: {
        orgId: customer.orgId,
        customerId: customer.id,
        dogId: parsed.data.dogId ?? null,
        key,
        summary: memoryUpdate,
        lastMessageAt: new Date(),
      },
      update: {
        summary: memoryUpdate,
        lastMessageAt: new Date(),
      },
    });
  }

  const responsePayload = { ...payloadJson };
  if ('memory_update' in responsePayload) {
    delete responsePayload.memory_update;
  }

  await prisma.customerWellnessChatLog.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId: parsed.data.dogId ?? null,
      symptoms: parsed.data.context?.symptoms ?? [],
      message: parsed.data.message,
      contextNotes: parsed.data.context?.recentNotes ?? null,
      response: responsePayload,
      riskLevel: responsePayload?.risk_level ?? null,
      model: process.env.WELLNESS_CHAT_MODEL ?? 'gpt-5-mini',
      metadata: {
        contextMode: includeFullContext ? 'full' : 'lite',
        timeZone: timeZone ?? null,
        memoryUpdated: Boolean(memoryUpdate),
      } as Prisma.InputJsonValue,
    },
  });

  await incrementWellnessUsage({
    customerId: customer.id,
    orgId: customer.orgId,
    chatsDelta: 1,
  });

  return NextResponse.json({
    ok: true,
    data: responsePayload,
  });
}

export const runtime = 'nodejs';
