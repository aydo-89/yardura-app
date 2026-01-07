import { env } from "@/lib/env";

export interface AiProviderConfig {
  primaryModel: string;
  fallbackModel?: string;
  defaultLocale: string;
}

const DEFAULT_PRIMARY_MODEL = env.VOICE_AGENT_PRIMARY_MODEL ?? "groq/llama-3.1-70b-versatile";
const DEFAULT_FALLBACK_MODEL = env.VOICE_AGENT_FALLBACK_MODEL ?? "cerebras/llama3.1-70b";
const DEFAULT_LOCALE = env.VOICE_AGENT_DEFAULT_LOCALE ?? "en-US";

export const voiceConfig = {
  get streamBaseUrl(): string {
    return (
      env.VOICE_AGENT_STREAM_BASE_URL ??
      process.env.VOICE_AGENT_STREAM_BASE_URL ??
      "ws://localhost:4001/stream"
    );
  },
  get knowledgePath(): string | undefined {
    return env.VOICE_AGENT_KNOWLEDGE_PATH ?? undefined;
  },
  get ai(): AiProviderConfig {
    return {
      primaryModel: DEFAULT_PRIMARY_MODEL,
      fallbackModel: DEFAULT_FALLBACK_MODEL,
      defaultLocale: DEFAULT_LOCALE,
    } satisfies AiProviderConfig;
  },
  get groqApiKey(): string | undefined {
    return env.GROQ_API_KEY ?? undefined;
  },
  get cerebrasApiKey(): string | undefined {
    return env.CEREBRAS_API_KEY ?? undefined;
  },
  get deepgramApiKey(): string | undefined {
    return env.DEEPGRAM_API_KEY ?? undefined;
  },
  get cartesiaApiKey(): string | undefined {
    return env.CARTESIA_API_KEY ?? undefined;
  },
  get elevenLabsApiKey(): string | undefined {
    return env.ELEVENLABS_API_KEY ?? undefined;
  },
};
