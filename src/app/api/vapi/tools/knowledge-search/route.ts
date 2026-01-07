import { NextRequest } from "next/server";
import { buildToolResponse, parseToolRequest } from "../utils";
import { voiceKnowledgeBase } from "@/lib/voice/knowledge-base";

/**
 * Vapi webhook for knowledge_base_search tool
 * Retrieves relevant knowledge documents based on user query
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    const query = args.query;
    if (!query) {
      return buildToolResponse(parsed, "No search query provided.");
    }

    const knowledge = await voiceKnowledgeBase.retrieve(query, 3);

    if (knowledge.length === 0) {
      return buildToolResponse(
        parsed,
        "I don't have specific information on that. Let me transfer you to our team who can help."
      );
    }

    const response = knowledge.map((doc) => doc.body).join("\n\n");

    console.log("[vapi-tools] Knowledge retrieved:", {
      query,
      documentCount: knowledge.length,
    });

    return buildToolResponse(parsed, response);
  } catch (error) {
    console.error("[vapi-tools] Error retrieving knowledge:", error);
    return buildToolResponse(
      parsed,
      "I'm having trouble accessing that information. Would you like me to transfer you to our team?",
      { status: 500 }
    );
  }
}
