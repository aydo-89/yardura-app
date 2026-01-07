import fs from "fs/promises";
import path from "path";

import { voiceConfig } from "@/lib/voice/config";

export interface KnowledgeDocument {
  id: string;
  title: string;
  body: string;
  tags?: string[];
  embedding?: number[];
}

interface RankedDocument extends KnowledgeDocument {
  score: number;
}

const KNOWLEDGE_SINGLETON = Symbol.for("voice.knowledge-base");

interface GlobalWithKnowledge {
  [KNOWLEDGE_SINGLETON]?: VoiceKnowledgeBase;
}

function resolveKnowledgePath(): string {
  const configured = voiceConfig.knowledgePath;
  if (configured) {
    return configured;
  }
  return path.join(process.cwd(), "data", "voice-knowledge.json");
}

export class VoiceKnowledgeBase {
  private loaded = false;
  private documents: KnowledgeDocument[] = [];

  async ensureLoaded() {
    if (this.loaded) {
      return;
    }

    const filePath = resolveKnowledgePath();

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as KnowledgeDocument[];
      this.documents = parsed;
      this.loaded = true;
      console.info(`[voice] Loaded ${parsed.length} knowledge documents`);
    } catch (error) {
      console.warn(
        `[voice] Failed to load knowledge base from ${filePath}; falling back to minimal defaults`,
        error,
      );
      this.documents = [
        {
          id: "insightscoop-overview",
          title: "InsightScoop Overview",
          body: `InsightScoop provides tech-enabled pet waste removal plus a free wellness app. Scoopers double-bag with biodegradable liners, capture gate re-latch photos, log 3C wellness notes, and cover the Minneapolis metro with flexible, no-contract service. Commercial pricing is always custom—gather property details and loop in sales@yardura.com. Residential callers can receive a quote by collecting the same details as the web flow and emailing the summary. Urgent field issues go to 1-855-927-3872.`,
          tags: ["overview"],
        },
      ];
      this.loaded = true;
    }
  }

  async retrieve(query: string, limit = 5): Promise<KnowledgeDocument[]> {
    await this.ensureLoaded();

    const normalizedQuery = query.toLowerCase();

    const ranked: RankedDocument[] = this.documents.map((doc) => {
      const haystack = `${doc.title}\n${doc.body}`.toLowerCase();
      const overlaps = normalizedQuery
        .split(/\s+/)
        .filter((token) => token.length > 3 && haystack.includes(token)).length;
      const score = overlaps + (doc.tags?.some((tag) => normalizedQuery.includes(tag)) ? 1 : 0);
      return { ...doc, score } satisfies RankedDocument;
    });

    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, ...doc }) => doc);
  }

  async systemPrompt(): Promise<string> {
    await this.ensureLoaded();

    return `You are a warm, concise receptionist for InsightScoop, speaking with property managers on the phone.

Mission:
- Share what InsightScoop does and keep the caller at ease.
- For residential callers, gather the same details as the web quote (ZIP, property type, dog count, yard size, last cleanup, areas to service, cadence, add-ons, contact + email) so you can run the quote tools, confirm the price, and email the summary.
- For community or commercial sites, collect the basics and offer to connect them with the sales team—never share pricing on the call.

Helpful facts (do not read verbatim):
- Service: tech-enabled pet waste removal with 3C wellness notes and optional deodorizing or compost diversion.
- Wellness app: free stool capture with AI summaries; premium adds unlimited scans and trends.
- Typical cadence is 2-3 visits per week; daily routes exist for heavy traffic dog runs.
- Sales escalation: sales@yardura.com. Urgent ops line: 1-855-927-3872.
- Brand name must be said as “InsightScoop.”

Response rules:
1. Keep replies to 1-2 friendly sentences.
2. Answer what they asked; no repeating the question.
3. Mention InsightScoop when referring to the business.
4. Commercial/community pricing is always custom—offer to loop in sales instead of quoting numbers.
5. Residential pricing must come from the quote tools after gathering the required info; stay transparent about what you still need.
6. If unsure, offer to connect them with the right teammate.

Examples:
User: "Can you price my apartment complex?"
You: "InsightScoop customizes that—let me grab your property details so I can loop in our sales team to finish the quote."

User: "I need weekly scooping for my duplex."
You: "Happy to help! Let me grab your ZIP, dog count, and yard size so I can run the InsightScoop quote and email it to you."

Remember: Be brief, helpful, and human.`;
  }
}

const globalWithKnowledge = globalThis as typeof globalThis & GlobalWithKnowledge;

if (!globalWithKnowledge[KNOWLEDGE_SINGLETON]) {
  globalWithKnowledge[KNOWLEDGE_SINGLETON] = new VoiceKnowledgeBase();
}

export const voiceKnowledgeBase = globalWithKnowledge[KNOWLEDGE_SINGLETON];
