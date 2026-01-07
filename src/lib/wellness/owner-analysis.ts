import OpenAI from 'openai';

import { env } from '@/lib/env';
import {
  COLOR_OPTIONS,
  CONSISTENCY_OPTIONS,
  CONTENT_OPTIONS,
  type ColorIndicator,
  type ConsistencyIndicator,
  type ContentIndicator,
} from '@/lib/service-visits/analysis-constants';

export type OwnerCaptureIndicator = 'watch' | 'monitor' | 'vet_now';

export type OwnerCaptureAnalysis = {
  color: ColorIndicator;
  consistency: ConsistencyIndicator;
  content: ContentIndicator;
  confidence: number;
  hydration_score: number;
  firmness_scale: number;
  indicator: OwnerCaptureIndicator;
  summary: string;
  what_this_could_mean: string;
  tips_tonight: string[];
  red_flags: string[];
  wellness_flag: boolean;
  flag_reason?: string | null;
  needs_review: boolean;
};

const DEFAULT_MODEL =
  process.env.WELLNESS_OWNER_CAPTURE_MODEL ??
  process.env.SERVICE_VISIT_ANALYSIS_MODEL ??
  'gpt-5-mini';

type OwnerCaptureAnalysisOptions = {
  detail?: 'low' | 'auto' | 'high';
  model?: string;
};

function resolveOpenAiKey(): string | null {
  return (
    process.env.WELLNESS_OWNER_CAPTURE_OPENAI_KEY ??
    process.env.OPENAI_API_KEY ??
    env.OPENAI_API_KEY ??
    null
  );
}

const OWNER_CAPTURE_SCHEMA = {
  name: 'OwnerCaptureAnalysis',
  schema: {
    type: 'object',
    required: [
      'color',
      'consistency',
      'content',
      'confidence',
      'hydration_score',
      'firmness_scale',
      'indicator',
      'summary',
      'what_this_could_mean',
      'tips_tonight',
      'red_flags',
      'wellness_flag',
      'flag_reason',
      'needs_review',
    ],
    properties: {
      color: { type: 'string', enum: COLOR_OPTIONS },
      consistency: { type: 'string', enum: CONSISTENCY_OPTIONS },
      content: { type: 'string', enum: CONTENT_OPTIONS },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      hydration_score: { type: 'number', minimum: 0, maximum: 100 },
      firmness_scale: { type: 'number', minimum: 1, maximum: 7 },
      indicator: { type: 'string', enum: ['watch', 'monitor', 'vet_now'] },
      summary: { type: 'string', maxLength: 240 },
      what_this_could_mean: { type: 'string', maxLength: 260 },
      tips_tonight: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 4 },
      red_flags: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 4 },
      wellness_flag: { type: 'boolean' },
      flag_reason: { type: 'string', maxLength: 140 },
      needs_review: { type: 'boolean' },
    },
    additionalProperties: false,
  },
} as const;

export async function analyzeOwnerCapture(
  imageUrl: string,
  options: OwnerCaptureAnalysisOptions = {},
): Promise<OwnerCaptureAnalysis> {
  const openAiKey = resolveOpenAiKey();
  if (!openAiKey) {
    throw new Error('OPENAI_API_KEY missing. Set WELLNESS_OWNER_CAPTURE_OPENAI_KEY or OPENAI_API_KEY.');
  }

  const client = new OpenAI({ apiKey: openAiKey });
  const model = options.model ?? DEFAULT_MODEL;
  const detail = options.detail ?? 'auto';

  const systemPrompt = [
    'You are a canine wellness assistant helping dog owners interpret stool photos.',
    'Classify color, consistency, and content using the approved categories.',
    'Estimate hydration and firmness (1-7 scale) based on stool appearance.',
    'Return a cautious, non-diagnostic summary with simple guidance.',
    'Set indicator to watch, monitor, or vet_now based on urgency.',
    'Use vet_now for blood, black/tarry stool, severe diarrhea, or other red flags.',
    'Set wellness_flag true when anything concerning is present and explain why.',
    'If the image is unclear or not stool, set needs_review true.',
    'Output must match the JSON schema exactly.',
  ].join(' ');

  const instructions = `Analyze this stool photo for a dog owner. Use these allowed values:\n\nColor: ${COLOR_OPTIONS.join(
    ', ',
  )}\nConsistency: ${CONSISTENCY_OPTIONS.join(
    ', ',
  )}\nContent: ${CONTENT_OPTIONS.join(
    ', ',
  )}\n\nKeep the summary short, practical, and non-alarming.`;

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: instructions },
          { type: 'input_image', image_url: imageUrl, detail },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: OWNER_CAPTURE_SCHEMA.name,
        schema: OWNER_CAPTURE_SCHEMA.schema,
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

  return JSON.parse(outputText.slice(firstBrace, lastBrace + 1)) as OwnerCaptureAnalysis;
}
