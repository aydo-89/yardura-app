import OpenAI, { toFile } from "openai";

import { env } from "@/lib/env";

export const encounterValues = [
  "NOT_HOME",
  "NO_THANK_YOU",
  "RUDE",
  "NO_SOLICITING",
  "LEFT_FLYER",
  "INTERESTED",
  "QUOTED",
  "SUBSCRIBED",
] as const;

export const objectionValues = [
  "WALKS",
  "SCOOP_IMMEDIATELY",
  "DOESNT_BOTHER",
  "BUSY",
  "COST",
] as const;

export const dogPresenceValues = ["HAS_DOG", "NO_DOG", "UNKNOWN"] as const;

const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const ANALYSIS_MODEL = "gpt-5-nano";

export interface OutboundTranscriptionInput {
  audioBuffer: Buffer;
  filename: string;
  businessId?: string | null;
}

export interface OutboundTranscriptionResult {
  transcript: string;
  summary: string;
  encounterTags: string[];
  dogPresence: (typeof dogPresenceValues)[number] | null;
  objectionTags: string[];
  dogCount?: number | null;
  followUp?: string | null;
}

function resolveOpenAiKey(): string {
  const key =
    process.env["OPENAI_API_KEY"] ||
    process.env.OPENAI_API_KEY ||
    env.OPENAI_API_KEY;

  if (!key || !key.trim().length) {
    throw new Error("OpenAI API key is not configured");
  }

  return key.trim();
}

export async function transcribeAndAnalyzeOutbound(
  input: OutboundTranscriptionInput,
): Promise<OutboundTranscriptionResult> {
  const apiKey = resolveOpenAiKey();
  const openaiClient = new OpenAI({ apiKey });

  const transcriptionResponse = await openaiClient.audio.transcriptions.create({
    file: await toFile(input.audioBuffer, input.filename || "visit-recording.webm"),
    model: TRANSCRIBE_MODEL,
    response_format: "json",
  });

  const transcript = transcriptionResponse.text?.trim();
  if (!transcript) {
    throw new Error("Unable to transcribe audio");
  }

  const systemPrompt = `You are an assistant that reviews door-to-door sales visit transcripts. Only use the enumerated values provided. Summaries must be 1-2 sentences. Use dogPresence of HAS_DOG when a dog is clearly present, NO_DOG when clearly absent, otherwise UNKNOWN. encounterTags describe the overall result of the visit. For objections, return any that were explicitly mentioned. If the rep left marketing materials without contact, use LEFT_FLYER.`;

  const responseFormatSchema = {
    type: "json_schema" as const,
    name: "outbound_visit_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        encounterTags: {
          type: "array",
          items: { type: "string", enum: encounterValues },
          default: [],
        },
        dogPresence: {
          type: ["string", "null"],
          enum: [...dogPresenceValues, null],
          default: null,
        },
        objectionTags: {
          type: "array",
          items: { type: "string", enum: objectionValues },
          default: [],
        },
        dogCount: {
          type: ["integer", "null"],
          minimum: 0,
          default: null,
        },
        followUp: {
          type: ["string", "null"],
          default: null,
        },
      },
      required: [
        "summary",
        "encounterTags",
        "dogPresence",
        "objectionTags",
        "dogCount",
        "followUp",
      ],
    },
    description:
      "Structured summary of an outbound sales encounter. encounterTags and objectionTags must use the provided enumerations.",
  } as const;

  const analysisResponse = await openaiClient.responses.create({
    model: ANALYSIS_MODEL,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Business ID (optional): ${input.businessId ?? "unknown"}\nTranscript:\n${transcript}\n\nReturn JSON that matches the provided schema exactly. No additional properties.`,
      },
    ],
    text: {
      format: responseFormatSchema,
    },
  });

  const rawResponse = analysisResponse as any;
  const outputText =
    typeof rawResponse.output_text === "string"
      ? rawResponse.output_text
      : Array.isArray(rawResponse.output)
        ? rawResponse.output
            .flatMap((item: any) => {
              if (!item || item.type !== "message" || !Array.isArray(item.content)) {
                return [];
              }
              return item.content
                .filter(
                  (content: any) =>
                    content?.type === "output_text" && typeof content.text === "string",
                )
                .map((content: any) => content.text as string);
            })
            .join("\n")
            .trim()
        : undefined;

  if (!outputText) {
    throw new Error("Unable to interpret AI analysis");
  }

  const parsed = JSON.parse(outputText);

  const safeEncounterTags = Array.isArray(parsed.encounterTags)
    ? parsed.encounterTags.filter((tag: string) => encounterValues.includes(tag as any))
    : [];
  const safeObjections = Array.isArray(parsed.objectionTags)
    ? parsed.objectionTags.filter((tag: string) => objectionValues.includes(tag as any))
    : [];

  return {
    transcript,
    summary: parsed.summary ?? "",
    encounterTags: safeEncounterTags,
    dogPresence: parsed.dogPresence ?? null,
    objectionTags: safeObjections,
    dogCount: typeof parsed.dogCount === "number" ? parsed.dogCount : null,
    followUp: parsed.followUp ?? null,
  };
}
