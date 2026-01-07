import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { Prisma } from "@prisma/client";

import { authOptions, safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  getCustomerWellnessAccess,
  incrementWellnessUsage,
} from "@/lib/wellness/access";

type SessionUser = {
  email?: string | null;
  id?: string | null;
};

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  dogId: z.string().optional(),
  context: z
    .object({
      symptoms: z.array(z.string()).optional(),
      recentNotes: z.string().optional(),
    })
    .optional(),
});

const CHAT_SCHEMA = {
  name: "WellnessChatResponse",
  schema: {
    type: "object",
    required: [
      "reply",
      "risk_level",
      "red_flags",
      "suggested_actions",
      "follow_up_questions",
      "disclaimer",
    ],
    properties: {
      reply: { type: "string", maxLength: 700 },
      risk_level: { type: "string", enum: ["watch", "monitor", "vet_now"] },
      red_flags: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 4 },
      suggested_actions: {
        type: "array",
        items: { type: "string", maxLength: 120 },
        maxItems: 4,
      },
      follow_up_questions: {
        type: "array",
        items: { type: "string", maxLength: 120 },
        maxItems: 3,
      },
      disclaimer: { type: "string", maxLength: 180 },
    },
    additionalProperties: false,
  },
} as const;

function extractOutputText(response: any): string | null {
  const direct = typeof response?.output_text === "string" ? response.output_text.trim() : "";
  if (direct) return direct;

  const fromMaybeObject = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value?.value === "string") return value.value;
    if (Array.isArray(value)) return value.map(fromMaybeObject).join("");
    return "";
  };

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "refusal") return null;
      const text =
        typeof part?.text === "string"
          ? part.text
          : typeof part?.content === "string"
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
    if (item?.type === "refusal") return "refusal";
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "refusal") return "refusal";
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

async function resolveCustomer() {
  const session = (await safeGetServerSession(authOptions as any)) as
    | { user?: SessionUser }
    | null;

  if (!session?.user?.email) {
    return {
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const customer = await prisma.customer.findFirst({
    where: { email: session.user.email },
    select: { id: true, orgId: true, userId: true },
  });

  if (!customer) {
    return {
      response: NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 }),
    };
  }

  return { session, customer };
}

export async function POST(request: NextRequest) {
  const resolved = await resolveCustomer();
  if ("response" in resolved) return resolved.response;

  const { customer, session } = resolved;
  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const access = await getCustomerWellnessAccess({
    customerId: customer.id,
    orgId: customer.orgId,
  });
  if (access.usage.chatsCount >= access.limits.chatsPerMonth) {
    return NextResponse.json(
      {
        ok: false,
        error: "limit_reached",
        message: "Monthly chat limit reached.",
        data: { usage: access.usage, limits: access.limits, tier: access.tier },
      },
      { status: 403 },
    );
  }

  let dogContext = "";
  if (parsed.data.dogId) {
    const userId = session?.user?.id ?? customer.userId ?? null;
    const dogWhere: Record<string, unknown> = { id: parsed.data.dogId };
    if (userId) {
      dogWhere.OR = [{ customerId: customer.id }, { userId }];
    } else {
      dogWhere.customerId = customer.id;
    }

    const dog = await prisma.dog.findFirst({
      where: dogWhere,
      select: { name: true, breed: true, age: true, weight: true },
    });
    if (dog) {
      dogContext = `Dog profile: ${dog.name ?? "Unknown"}${dog.breed ? `, ${dog.breed}` : ""}${
        typeof dog.age === "number" ? `, ${dog.age} yrs` : ""
      }${typeof dog.weight === "number" ? `, ${dog.weight} lbs` : ""}.`;
    }
  }

  const openAiKey = resolveOpenAiKey();
  if (!openAiKey) {
    return NextResponse.json({ ok: false, error: "AI not configured" }, { status: 500 });
  }

  const client = new OpenAI({ apiKey: openAiKey });
  const systemPrompt = [
    "You are an AI wellness assistant for dog owners.",
    "You are not a veterinarian and must not diagnose or prescribe.",
    "Provide practical, calm guidance with red-flag escalation when needed.",
    "Use watch for mild issues, monitor for moderate symptoms, vet_now for urgent symptoms.",
    "Always include a short disclaimer.",
    "Ask follow-up questions when details are missing.",
  ].join(" ");

  const userPrompt = [
    parsed.data.message,
    dogContext ? `\n${dogContext}` : "",
    parsed.data.context?.symptoms?.length
      ? `\nSymptoms: ${parsed.data.context.symptoms.join(", ")}`
      : "",
    parsed.data.context?.recentNotes ? `\nNotes: ${parsed.data.context.recentNotes}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const response = await client.responses.create({
    model: process.env.WELLNESS_CHAT_MODEL ?? "gpt-5-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: CHAT_SCHEMA.name,
        schema: CHAT_SCHEMA.schema,
      },
    },
  } as any);

  const outputText = extractOutputText(response);
  if (!outputText) {
    const refusal = findRefusal(response);
    if (refusal) {
      console.warn("[wellness-chat] model refusal", describeResponseShape(response));
      return NextResponse.json(
        { ok: false, error: "AI refused to respond" },
        { status: 502 },
      );
    }
    console.error("[wellness-chat] missing model output", describeResponseShape(response));
    return NextResponse.json({ ok: false, error: "AI response missing" }, { status: 502 });
  }

  const firstBrace = outputText.indexOf("{");
  const lastBrace = outputText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    return NextResponse.json({ ok: false, error: "AI response invalid" }, { status: 502 });
  }

  const payloadJson = JSON.parse(outputText.slice(firstBrace, lastBrace + 1));

  await prisma.customerWellnessChatLog.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      dogId: parsed.data.dogId ?? null,
      symptoms: parsed.data.context?.symptoms ?? [],
      message: parsed.data.message,
      contextNotes: parsed.data.context?.recentNotes ?? null,
      response: payloadJson,
      riskLevel: payloadJson?.risk_level ?? null,
      model: process.env.WELLNESS_CHAT_MODEL ?? "gpt-5-mini",
      metadata: Prisma.JsonNull,
    },
  });

  await incrementWellnessUsage({
    customerId: customer.id,
    orgId: customer.orgId,
    chatsDelta: 1,
  });

  return NextResponse.json({
    ok: true,
    data: payloadJson,
  });
}

export const runtime = "nodejs";
