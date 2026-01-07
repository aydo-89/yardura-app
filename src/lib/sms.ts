import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import twilio from "twilio";

import { env } from "./env";

let smsClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  if (!smsClient) {
    smsClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return smsClient;
}

export interface SendSmsOptions {
  to: string;
  body: string;
  mediaUrls?: string[];
}

export interface SendSmsResult {
  sid?: string;
  status: MessageInstance["status"] | "skipped";
}

export async function sendSms({ to, body, mediaUrls = [] }: SendSmsOptions) {
  console.log("[sms] DEBUG: Checking Twilio configuration", {
    TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID ? `${env.TWILIO_ACCOUNT_SID.substring(0, 10)}...` : "MISSING",
    TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN ? "SET" : "MISSING",
    TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER || "MISSING",
    TWILIO_FROM_NUMBER: env.TWILIO_FROM_NUMBER || "MISSING",
    TWILIO_MESSAGING_SERVICE_SID: env.TWILIO_MESSAGING_SERVICE_SID || "MISSING",
  });
  
  const client = getTwilioClient();
  // Note: TWILIO_YARDURA_SID is an API Key (SK...), not a Messaging Service SID (MG...)
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID ?? undefined;
  const from = env.TWILIO_FROM_NUMBER ?? env.TWILIO_PHONE_NUMBER ?? undefined;

  if (!client || (!messagingServiceSid && !from)) {
    console.info("[sms] Twilio not fully configured; skipping send", {
      to,
      body,
      mediaUrls,
      hasClient: !!client,
      hasMessagingService: !!messagingServiceSid,
      hasFromNumber: !!from,
    });
    return { status: "skipped" } satisfies SendSmsResult;
  }

  try {
    const message = await client.messages.create({
      to,
      body,
      ...(mediaUrls.length ? { mediaUrl: mediaUrls } : {}),
      ...(messagingServiceSid ? { messagingServiceSid } : { from }),
    });

    return { sid: message.sid, status: message.status } satisfies SendSmsResult;
  } catch (error) {
    console.error("[sms] Failed to send Twilio message", error);
    throw error;
  }
}

export interface ArrivalWindowSmsInput {
  to: string;
  customerName?: string | null;
  windowLabel?: string | null;
  etaMinutes?: number | null;
  technicianName?: string | null;
  includePetReminder?: boolean;
}

export function buildArrivalWindowMessage(input: ArrivalWindowSmsInput): string {
  const parts: string[] = [];
  const greeting = input.customerName
    ? `Hi ${input.customerName},`
    : "Hi there,";
  parts.push(greeting);

  const windowLabel = input.windowLabel ?? "your scheduled window";
  const technician = input.technicianName
    ? `${input.technicianName} from InsightScoop`
    : "your InsightScoop technician";

  if (input.etaMinutes && input.etaMinutes > 0) {
    parts.push(
      `${technician} is on the way and should arrive within ${Math.max(
        1,
        Math.round(input.etaMinutes),
      )} minutes (${windowLabel}).`,
    );
  } else {
    parts.push(`${technician} is headed your way for ${windowLabel}.`);
  }

  if (input.includePetReminder) {
    parts.push("Please secure pups indoors so we can scoop safely.");
  }

  parts.push("Reply if you need to adjust anything.");
  return parts.join(" ");
}

export async function sendArrivalWindowSms(input: ArrivalWindowSmsInput) {
  const body = buildArrivalWindowMessage(input);
  return sendSms({ to: input.to, body });
}
