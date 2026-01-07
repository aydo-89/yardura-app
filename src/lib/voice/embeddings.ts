import { env } from "@/lib/env";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

/**
 * Generate embeddings using OpenAI's text-embedding-3-small model
 * (Very affordable: $0.02 per 1M tokens)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for generating embeddings");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small", // 1536 dimensions, very fast and cheap
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embeddings API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  return {
    embedding: data.data[0].embedding,
    model: data.model,
  };
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}




