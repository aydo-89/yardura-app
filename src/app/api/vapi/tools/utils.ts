import { NextResponse } from "next/server";

type ToolInvocationMode = "tool" | "http";

export interface ParsedToolRequest {
  toolCallId: string;
  args: Record<string, any>;
  mode: ToolInvocationMode;
  rawBody: Record<string, any>;
}

/**
 * Normalizes Vapi tool invocation payloads and manual HTTP test payloads
 */
export function parseToolRequest(body: unknown): ParsedToolRequest {
  if (!body || typeof body !== "object") {
    return {
      toolCallId: "manual-test",
      args: {},
      mode: "http",
      rawBody: {},
    };
  }

  const payload = body as Record<string, any>;
  const toolCall = payload.message?.toolCallList?.[0];

  if (toolCall) {
    // Parse arguments from VAPI format: toolCall.function.arguments can be string or object
    let args = {};
    try {
      if (typeof toolCall.function?.arguments === "string") {
        args = JSON.parse(toolCall.function.arguments);
      } else if (typeof toolCall.function?.arguments === "object" && toolCall.function.arguments !== null) {
        args = toolCall.function.arguments;
      } else if (toolCall.arguments) {
        args = toolCall.arguments;
      }
    } catch (error) {
      console.error("Failed to parse tool arguments:", error);
    }

    return {
      toolCallId: toolCall.id ?? "tool-call",
      args,
      mode: "tool",
      rawBody: payload,
    };
  }

  const args =
    payload.arguments && typeof payload.arguments === "object"
      ? payload.arguments
      : payload;

  return {
    toolCallId:
      typeof payload.toolCallId === "string" && payload.toolCallId.length > 0
        ? payload.toolCallId
        : "manual-test",
    args,
    mode: "http",
    rawBody: payload,
  };
}

interface ToolResponseOptions {
  status?: number;
  metadata?: Record<string, unknown>;
  resultOverride?: unknown;
}

/**
 * Generates a Vapi-compatible response while remaining human-friendly for manual tests
 */
export function buildToolResponse(
  parsed: ParsedToolRequest,
  message: string,
  options: ToolResponseOptions = {},
) {
  const { status = 200, metadata, resultOverride } = options;

  if (parsed.mode === "tool") {
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: parsed.toolCallId,
            result: resultOverride ?? message,
            ...(metadata ? { metadata } : {}),
          },
        ],
      },
      { status },
    );
  }

  const payload: Record<string, unknown> = {
    ok: status >= 200 && status < 300,
    message,
    toolCallId: parsed.toolCallId,
  };

  if (metadata) {
    Object.assign(payload, metadata);
  }

  return NextResponse.json(payload, { status });
}
