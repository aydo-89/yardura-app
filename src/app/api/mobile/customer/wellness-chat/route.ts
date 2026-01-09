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
      'memory_update',
    ],
    properties: {
      reply: { type: 'string', maxLength: 800 },
      risk_level: { type: 'string', enum: ['watch', 'monitor', 'vet_now'] },
      red_flags: { type: 'array', items: { type: 'string', maxLength: 100 }, maxItems: 4 },
      suggested_actions: { type: 'array', items: { type: 'string', maxLength: 150 }, maxItems: 5 },
      follow_up_questions: { type: 'array', items: { type: 'string', maxLength: 150 }, maxItems: 3 },
      disclaimer: { type: 'string', maxLength: 200 },
      memory_update: { type: 'string', maxLength: 1200 },
    },
    additionalProperties: false,
  },
} as const;

function extractOutputText(response: any): string | null {
  const direct = typeof response?.output_text === 'string' ? response.output_text.trim() : '';
  if (direct) return direct;

  const fromMaybeObject = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value?.value === 'string') return value.value;
    if (Array.isArray(value)) return value.map(fromMaybeObject).join('');
    return '';
  };

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === 'refusal') return null;
      const text =
        typeof part?.text === 'string'
          ? part.text
          : typeof part?.content === 'string'
            ? part.content
            : fromMaybeObject(part?.text);
      const trimmed = text.trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
}

function findRefusal(response: any): string | null {
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item?.type === 'refusal') return 'refusal';
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === 'refusal') return 'refusal';
    }
  }
  return null;
}

function describeResponseShape(response: any) {
  try {
    return {
      id: response?.id,
      model: response?.model,
      output: Array.isArray(response?.output)
        ? response.output.map((item: any) => ({
            type: item?.type,
            role: item?.role,
            contentTypes: Array.isArray(item?.content)
              ? item.content.map((c: any) => c?.type ?? typeof c)
              : [],
          }))
        : [],
    };
  } catch {
    return { id: response?.id, model: response?.model };
  }
}

function resolveOpenAiKey(): string | null {
  return (
    process.env.WELLNESS_CHAT_OPENAI_KEY ??
    process.env.OPENAI_API_KEY ??
    env.OPENAI_API_KEY ??
    null
  );
}

function applyContextPreface(reply: string, mode: 'reply' | 'analysis' = 'analysis'): string {
  const trimmed = reply.trim();
  const snippet = trimmed.slice(0, 160).toLowerCase();
  const mentionsContext =
    /wellness|account|billing|service|schedule|scan|stool|walk|log|app data|in-app/.test(
      snippet,
    );
  if (mentionsContext) return trimmed;
  if (mode === 'reply') {
    return `From your app data, ${trimmed}`;
  }
  return `Using your in-app wellness and account data where relevant, ${trimmed}`;
}

function clampReply(reply: string, maxLength: number): string {
  const trimmed = reply.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const safeLength = Math.max(0, maxLength - 3);
  return `${trimmed.slice(0, safeLength).trimEnd()}...`;
}

function summarizeContextUsed(
  context: Record<string, unknown>,
  semanticHighlights: Awaited<ReturnType<typeof searchWellnessEmbeddings>> | null,
): string[] {
  const used = new Set<string>();
  const add = (label: string, condition: unknown) => {
    if (condition) used.add(label);
  };
  const listSize = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  const customer = context.customer as Record<string, unknown> | null | undefined;
  const memory = context.memory as Record<string, unknown> | null | undefined;
  const captures = context.captures as { owner?: unknown[]; pro?: unknown[] } | null | undefined;
  const food = context.food as
    | { inventory?: unknown[]; logs?: unknown[]; schedules?: unknown[] }
    | null
    | undefined;
  const reminders = context.reminders as
    | { overdueCount?: number; upcoming?: unknown[] }
    | null
    | undefined;
  const walks = context.walks as
    | { last7Days?: { count?: number }; recent?: unknown[] }
    | null
    | undefined;
  const service = context.service as Record<string, unknown> | null | undefined;
  const billing = context.billing as Record<string, unknown> | null | undefined;

  add('Customer profile', customer);
  add('Dog profiles', listSize(context.dogs) > 0);
  add(
    'Assistant memory',
    Boolean(memory?.householdSummary) || Boolean(memory?.dogSummary),
  );
  add('Weekly reports', listSize(context.wellnessReports) > 0);
  add('Daily check-ins', listSize(context.dailyCheckIns) > 0);
  add(
    'Stool scans',
    listSize(captures?.owner) > 0 || listSize(captures?.pro) > 0,
  );
  add('Food inventory', listSize(food?.inventory) > 0);
  add('Food logs', listSize(food?.logs) > 0);
  add('Food schedules', listSize(food?.schedules) > 0);
  add(
    'Reminders',
    (reminders?.overdueCount ?? 0) > 0 || listSize(reminders?.upcoming) > 0,
  );
  add(
    'Walks',
    (walks?.last7Days?.count ?? 0) > 0 || listSize(walks?.recent) > 0,
  );
  add('Service schedule', Boolean(service?.job) || Boolean(service?.nextVisit));
  add('Billing', Boolean(billing?.plan));
  add('Chat history', listSize(context.chats) > 0);
  add('Local weather', Boolean(context.weather));
  add('Semantic recall', listSize(semanticHighlights) > 0);

  return Array.from(used);
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

  const requestedDogId = parsed.data.dogId ?? null;
  let resolvedDogId: string | null = null;
  if (requestedDogId) {
    const dog = await prisma.dog.findFirst({
      where: { id: requestedDogId, customerId: customer.id },
      select: { id: true },
    });
    resolvedDogId = dog?.id ?? null;
    if (!resolvedDogId) {
      console.warn('[wellness-chat] ignoring unknown dogId for customer', {
        requestedDogId,
        customerId: customer.id,
      });
    }
  }

  const includeFullContext = access.tier === 'PREMIUM';
  const timeZone = request.headers.get('x-time-zone');
  const { context } = await buildWellnessChatContext({
    customerId: customer.id,
    orgId: customer.orgId,
    dogId: resolvedDogId,
    includeFullContext,
    timeZone,
  });
  let semanticHighlights: Awaited<ReturnType<typeof searchWellnessEmbeddings>> | null = null;
  if (includeFullContext) {
    try {
      const docs = await collectWellnessEmbeddingDocs({
        customerId: customer.id,
        orgId: customer.orgId,
        dogId: resolvedDogId,
      });
      await ensureWellnessEmbeddings({ docs, maxDocs: 24 });
      semanticHighlights = await searchWellnessEmbeddings({
        customerId: customer.id,
        dogId: resolvedDogId,
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
          'Reply in 2-3 flowing sentences (max 500 characters). Do NOT use bullet points or lists in this short reply.',
          'Write in natural prose. Keep it conversational and easy to read.',
          'If you used in-app data, mention it briefly (e.g., "Based on your data"). Do not list categories.',
        ].join(' ')
      : [
          'You are an AI wellness analyst for dog owners.',
          'Return JSON that matches the schema.',
          'Use watch for mild, monitor for moderate, vet_now for urgent symptoms.',
          'If the question is about account/service, keep risk_level at watch unless red flags exist.',
          'If assistant_reply is provided, use it verbatim for reply.',
          'If semanticHighlights exist, cite them for context in suggested actions.',
          'Never diagnose or prescribe. Always include a short disclaimer.',
          'For suggested_actions, write each item as a complete, standalone sentence. Do not start with dashes or bullets.',
          'Each suggested_action should be actionable and specific (e.g., "Monitor water intake for the next 24 hours").',
          'IMPORTANT: follow_up_questions are questions the USER might want to ASK YOU next to learn more.',
          'They are NOT questions you ask the user. They are conversation starters for the user.',
          'Example good follow_up_questions: "What foods help with digestive issues?", "Should I change the feeding schedule?", "What are warning signs to watch for?"',
          'Example BAD follow_up_questions (do NOT do this): "Has your dog been drinking enough water?", "Did you notice any changes?"',
          'Always include memory_update: a short, stable summary of key info for future context (or empty string if nothing new to remember).',
          'Ensure the reply makes it clear you used relevant in-app wellness/service/account data when available or that none were found.',
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

  const assistantReply =
    mode === 'analysis' && parsed.data.reply
      ? clampReply(parsed.data.reply, 680)
      : null;

  if (mode === 'analysis' && assistantReply) {
    messages.push({
      role: 'assistant',
      content: `assistant_reply: ${assistantReply}`,
    });
  }

  messages.push({ role: 'user', content: userPrompt });

  let response: any;
  try {
    response =
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
  } catch (err: any) {
    console.error('[wellness-chat] OpenAI API error', {
      mode,
      error: err?.message ?? String(err),
      status: err?.status,
      code: err?.code,
      type: err?.type,
    });
    return NextResponse.json(
      { ok: false, error: 'AI service error', details: err?.message ?? String(err) },
      { status: 502 },
    );
  }

  const outputText = extractOutputText(response);
  if (!outputText) {
    const refusal = findRefusal(response);
    if (refusal) {
      console.warn('[wellness-chat] model refusal', describeResponseShape(response));
      return NextResponse.json({ ok: false, error: 'AI refused to respond' }, { status: 502 });
    }
    console.error('[wellness-chat] AI response missing output', {
      mode,
      shape: describeResponseShape(response),
    });
    return NextResponse.json({ ok: false, error: 'AI response missing' }, { status: 502 });
  }

  if (mode === 'reply') {
    const replyText = clampReply(applyContextPreface(outputText, 'reply'), 500);
    return NextResponse.json({
      ok: true,
      data: { reply: replyText },
    });
  }

  const firstBrace = outputText.indexOf('{');
  const lastBrace = outputText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    console.error('[wellness-chat] AI response invalid - no JSON found', outputText);
    return NextResponse.json({ ok: false, error: 'AI response invalid' }, { status: 502 });
  }

  let payloadJson: any;
  try {
    payloadJson = JSON.parse(outputText.slice(firstBrace, lastBrace + 1));
  } catch (err: any) {
    console.error('[wellness-chat] JSON parse error', {
      mode,
      error: err?.message,
      outputText: outputText.slice(0, 500),
    });
    return NextResponse.json(
      { ok: false, error: 'AI response parse error', details: err?.message },
      { status: 502 },
    );
  }
  if (assistantReply) {
    payloadJson.reply = assistantReply;
  } else if (typeof payloadJson.reply === 'string') {
    payloadJson.reply = applyContextPreface(payloadJson.reply, 'analysis');
  }

  const memoryUpdate =
    includeFullContext && typeof payloadJson.memory_update === 'string'
      ? payloadJson.memory_update.trim()
      : null;

  if (memoryUpdate) {
    const key = resolvedDogId ? `dog:${resolvedDogId}` : 'household';
    try {
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
          dogId: resolvedDogId,
          key,
          summary: memoryUpdate,
          lastMessageAt: new Date(),
        },
        update: {
          summary: memoryUpdate,
          lastMessageAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[wellness-chat] failed to persist memory update', err);
    }
  }

  const responsePayload = { ...payloadJson };
  if ('memory_update' in responsePayload) {
    delete responsePayload.memory_update;
  }
  responsePayload.context_used = summarizeContextUsed(
    contextPayload,
    semanticHighlights,
  );

  try {
    await prisma.customerWellnessChatLog.create({
      data: {
        orgId: customer.orgId,
        customerId: customer.id,
        dogId: resolvedDogId,
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
  } catch (err) {
    console.error('[wellness-chat] failed to persist chat log', err);
  }

  try {
    await incrementWellnessUsage({
      customerId: customer.id,
      orgId: customer.orgId,
      chatsDelta: 1,
    });
  } catch (err) {
    console.error('[wellness-chat] failed to increment usage', err);
  }

  return NextResponse.json({
    ok: true,
    data: responsePayload,
  });
}

export const runtime = 'nodejs';
