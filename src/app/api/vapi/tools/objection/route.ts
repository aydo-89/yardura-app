import { NextRequest } from "next/server";
import { buildToolResponse, parseToolRequest } from "../utils";
import { voiceKnowledgeBase } from "@/lib/voice/knowledge-base";

/**
 * Vapi webhook for handle_objection tool
 * Retrieves objection handling knowledge based on the objection type
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    const objectionType = args.objectionType;
    if (!objectionType) {
      return buildToolResponse(parsed, "No objection type provided.");
    }

    console.log("[vapi-tools] Objection handler called:", {
      objectionType,
      callId: body.message?.call?.id || body.call?.id,
    });

    // Retrieve knowledge documents matching the objection
    const knowledge = await voiceKnowledgeBase.retrieve(
      `objection-${objectionType}`,
      1
    );

    if (knowledge.length === 0 || !knowledge[0].body) {
      console.warn("[vapi-tools] No knowledge found for objection:", objectionType);
      return buildToolResponse(
        parsed,
        "I understand your concern. Let me share what I know about our service..."
      );
    }

    const response = knowledge[0].body;
    console.log("[vapi-tools] Objection response found:", {
      objectionType,
      responseLength: response.length,
    });

    return buildToolResponse(parsed, response);
  } catch (error) {
    console.error("[vapi-tools] Error handling objection:", error);
    return buildToolResponse(
      parsed,
      "I hear your concern. Would you like me to connect you with our team to discuss this further?",
      { status: 500 }
    );
  }
}
