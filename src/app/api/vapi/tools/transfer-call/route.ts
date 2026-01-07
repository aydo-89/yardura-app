import { NextRequest, NextResponse } from "next/server";
import { parseToolRequest } from "../utils";

/**
 * Vapi webhook for transfer_call tool
 * Transfers the call to a live team member
 * 
 * VAPI expects a specific response format for call transfers:
 * - The result must include a "destination" object with the transfer details
 * - This triggers VAPI's built-in call forwarding
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseToolRequest(body);
    const { args } = parsed;

    const reason = args.reason || "customer requested live agent";
    const transferNumber = "+16125819812"; // Your team number

    console.log("[vapi-tools] Call transfer requested:", {
      reason,
      callId: body.message?.call?.id || body.call?.id,
      from: body.message?.call?.customer?.number || body.call?.customer?.number,
      transferTo: transferNumber,
    });

    // VAPI expects this specific format for transfers
    // See: https://docs.vapi.ai/phone-calling/transfer-calls
    if (parsed.mode === "tool") {
      return NextResponse.json({
        results: [
          {
            toolCallId: parsed.toolCallId,
            result: "Transferring call now...",
          },
        ],
        // This destination object triggers VAPI's call transfer
        destination: {
          type: "number",
          number: transferNumber,
          message: "Please hold while I transfer you to our team.",
          description: reason,
        },
      });
    }

    // HTTP test mode
    return NextResponse.json({
      ok: true,
      message: "Transfer would go to " + transferNumber,
      destination: {
        type: "number",
        number: transferNumber,
      },
    });
  } catch (error) {
    console.error("[vapi-tools] Transfer call error:", error);
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: "error",
            result: "I'm having trouble with the transfer. Please call us directly at 612-581-9812 and we'll help you right away.",
          },
        ],
      },
      { status: 500 }
    );
  }
}

