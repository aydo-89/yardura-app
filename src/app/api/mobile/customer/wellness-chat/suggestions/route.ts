import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { env } from '@/lib/env';
import { getCustomerWellnessAccess } from '@/lib/wellness/access';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function resolveOpenAiKey(): string | null {
  return (
    process.env.WELLNESS_CHAT_OPENAI_KEY ??
    process.env.OPENAI_API_KEY ??
    env.OPENAI_API_KEY ??
    null
  );
}

type SuggestionCategory = {
  category: string;
  icon: string;
  questions: string[];
};

const SUGGESTIONS_SCHEMA = {
  name: 'QuickQuestionSuggestions',
  schema: {
    type: 'object',
    required: ['categories'],
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'object',
          required: ['category', 'icon', 'questions'],
          properties: {
            category: { type: 'string', maxLength: 20 },
            icon: { type: 'string', enum: ['heartbeat', 'cutlery', 'medkit', 'calendar', 'paw', 'bug'] },
            questions: {
              type: 'array',
              items: { type: 'string', maxLength: 80 },
              minItems: 2,
              maxItems: 4,
            },
          },
          additionalProperties: false,
        },
        minItems: 3,
        maxItems: 4,
      },
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
    select: { id: true, orgId: true, name: true, city: true, state: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
  }

  // Check if user is premium - this is a premium-only feature
  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });

  // Premium if tier is PREMIUM (regardless of source), or has active service
  const isPremium =
    access.tier === 'PREMIUM' ||
    access.hasActiveService;

  if (!isPremium) {
    return NextResponse.json({
      ok: true,
      data: {
        isPremium: false,
        categories: null,
        message: 'AI-generated suggestions require Premium',
      },
    });
  }

  // Gather account data for context
  const [dogs, recentReports, recentCaptures, reminders, nextVisit, recentCheckIns] =
    await Promise.all([
      prisma.dog.findMany({
        where: { customerId: customer.id },
        select: {
          id: true,
          name: true,
          breed: true,
          age: true,
          weight: true,
          allergies: true,
          medications: true,
          dietNotes: true,
          vetName: true,
          vetClinic: true,
        },
        take: 5,
      }),
      // Get recent weekly wellness reports
      prisma.weeklyWellnessReport.findMany({
        where: { customerId: customer.id },
        select: {
          symptomTags: true,
          appetite: true,
          hydration: true,
          energy: true,
          vomiting: true,
          diarrhea: true,
          noIssues: true,
          weekStart: true,
        },
        orderBy: { weekStart: 'desc' },
        take: 4,
      }),
      prisma.customerWellnessCapture.findMany({
        where: { customerId: customer.id },
        select: {
          analysisResult: true,
          capturedAt: true,
        },
        orderBy: { capturedAt: 'desc' },
        take: 5,
      }),
      prisma.customerWellnessReminder.findMany({
        where: { customerId: customer.id, active: true },
        select: {
          title: true,
          category: true,
          nextDueAt: true,
        },
        orderBy: { nextDueAt: 'asc' },
        take: 5,
      }),
      prisma.serviceVisit.findFirst({
        where: {
          job: { customerId: customer.id },
          status: 'SCHEDULED',
          scheduledDate: { gte: new Date() },
        },
        select: {
          scheduledDate: true,
          serviceType: true,
        },
        orderBy: { scheduledDate: 'asc' },
      }),
      // Additional weekly reports for check-in context
      prisma.weeklyWellnessReport.findMany({
        where: { customerId: customer.id },
        select: {
          appetite: true,
          energy: true,
          hydration: true,
          vomiting: true,
          diarrhea: true,
          weekStart: true,
        },
        orderBy: { weekStart: 'desc' },
        take: 7,
      }),
    ]);

  // Build context summary for AI
  const contextSummary = {
    customer: {
      name: customer.name,
      location: customer.city && customer.state ? `${customer.city}, ${customer.state}` : null,
    },
    dogs: dogs.map((d: typeof dogs[number]) => ({
      name: d.name,
      breed: d.breed,
      age: d.age,
      weight: d.weight,
      allergies: d.allergies,
      medications: d.medications,
      dietNotes: d.dietNotes,
      hasVet: Boolean(d.vetName || d.vetClinic),
    })),
    recentHealth: {
      reports: recentReports.map((r: typeof recentReports[number]) => ({
        symptoms: r.symptomTags,
        appetite: r.appetite,
        hydration: r.hydration,
        energy: r.energy,
        vomiting: r.vomiting,
        diarrhea: r.diarrhea,
        noIssues: r.noIssues,
        date: r.weekStart,
      })),
      captures: recentCaptures.map((c: typeof recentCaptures[number]) => {
        const result = c.analysisResult as Record<string, unknown> | null;
        return {
          indicator: result?.indicator ?? null,
          firmness: result?.firmness_scale ?? null,
          hydration: result?.hydration_score ?? null,
          date: c.capturedAt,
        };
      }),
      checkIns: recentCheckIns.map((c: typeof recentCheckIns[number]) => ({
        appetite: c.appetite,
        energy: c.energy,
        hydration: c.hydration,
        vomiting: c.vomiting,
        diarrhea: c.diarrhea,
        date: c.weekStart,
      })),
    },
    reminders: reminders.map((r: typeof reminders[number]) => ({
      title: r.title,
      category: r.category,
      dueAt: r.nextDueAt,
    })),
    service: nextVisit
      ? {
          nextVisitDate: nextVisit.scheduledDate,
          serviceType: nextVisit.serviceType,
        }
      : null,
  };

  const openAiKey = resolveOpenAiKey();
  if (!openAiKey) {
    return NextResponse.json(
      { ok: false, error: 'AI not configured' },
      { status: 500 },
    );
  }

  const client = new OpenAI({ apiKey: openAiKey });

  const systemPrompt = [
    'You generate HIGHLY PERSONALIZED quick questions for a dog wellness chat assistant.',
    'Create 3-4 categories with 2-4 questions each. Questions MUST reference specific data from their account.',
    '',
    'CRITICAL RULES - Questions must be SPECIFIC, NOT GENERIC:',
    '',
    '1. ALWAYS use actual dog names - NEVER say "your dog" or "my dog"',
    '   - Good: "Why is Bella\'s stool soft lately?"',
    '   - Bad: "Why is my dog\'s stool soft?"',
    '',
    '2. Reference EXACT data values from the account:',
    '   - Allergies: "Is chicken still causing issues for Max?"',
    '   - Medications: "When should I give Cooper his Apoquel?"',
    '   - Age: "At 8 years old, should Luna get more joint support?"',
    '   - Weight: "Is 45 lbs healthy for a Labrador like Duke?"',
    '   - Breed: "What health issues should I watch for in Bella\'s Golden Retriever breed?"',
    '',
    '3. Reference RECENT health data if present:',
    '   - Symptoms: "Bella had diarrhea this week - when should I worry?"',
    '   - Energy: "Max has been low energy lately - is that concerning?"',
    '   - Appetite: "Cooper\'s appetite dropped - what could cause that?"',
    '   - Stool captures: "Luna\'s last scan showed firmness of 3 - is that normal?"',
    '',
    '4. Reference reminders/upcoming events:',
    '   - "Bella\'s flea medication is due tomorrow - any tips?"',
    '   - "Max has a vet appointment coming up - what should I ask?"',
    '',
    '5. If multiple dogs, include questions about EACH dog by name',
    '',
    'Categories (use icon names exactly):',
    '- Health (heartbeat): Stool, symptoms, wellness from recent data',
    '- Diet (cutlery): Food, allergies by name, nutrition for their breed/age',
    '- Care (medkit): Medications by name, vet visits, exercise for their breed',
    '- Service (calendar): Scooping visits, next service date',
    '- Pets (paw): Breed-specific questions using actual breed name',
    '- Prevention (bug): Parasites, vaccinations based on their reminders',
    '',
    'Keep questions under 80 characters. Be conversational but DATA-DRIVEN.',
    'Every question should feel like it was written FOR THIS SPECIFIC USER.',
  ].join('\n');

  const userPrompt = `Generate personalized quick questions based on this account data:\n\n${JSON.stringify(contextSummary, null, 2)}`;

  let response: any;
  try {
    response = await client.responses.create({
      model: process.env.WELLNESS_SUGGESTIONS_MODEL ?? 'gpt-5-nano',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: SUGGESTIONS_SCHEMA.name,
          schema: SUGGESTIONS_SCHEMA.schema,
        },
      },
    } as any);
  } catch (err: any) {
    console.error('[wellness-suggestions] OpenAI API error', {
      error: err?.message ?? String(err),
      status: err?.status,
    });
    return NextResponse.json(
      { ok: false, error: 'AI service error' },
      { status: 502 },
    );
  }

  const outputText = extractOutputText(response);
  if (!outputText) {
    console.error('[wellness-suggestions] AI response missing output');
    return NextResponse.json(
      { ok: false, error: 'AI response missing' },
      { status: 502 },
    );
  }

  const firstBrace = outputText.indexOf('{');
  const lastBrace = outputText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    console.error('[wellness-suggestions] AI response invalid - no JSON found');
    return NextResponse.json(
      { ok: false, error: 'AI response invalid' },
      { status: 502 },
    );
  }

  let parsed: { categories: SuggestionCategory[] };
  try {
    parsed = JSON.parse(outputText.slice(firstBrace, lastBrace + 1));
  } catch (err: any) {
    console.error('[wellness-suggestions] JSON parse error', err?.message);
    return NextResponse.json(
      { ok: false, error: 'AI response parse error' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      isPremium: true,
      categories: parsed.categories,
    },
  });
}

export const runtime = 'nodejs';
