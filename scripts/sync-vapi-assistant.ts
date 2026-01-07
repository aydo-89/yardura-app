#!/usr/bin/env npx tsx
/**
 * Vapi Assistant Sync Script
 * 
 * This script syncs the Vapi assistant configuration from code to the Vapi platform.
 * Run with: npm run vapi:sync
 * 
 * Environment variables required:
 * - VAPI_API_KEY: Your Vapi API key
 * - VAPI_ASSISTANT_ID: The ID of the existing assistant to update (optional for create)
 * 
 * If VAPI_ASSISTANT_ID is not set, a new assistant will be created and the ID will be printed.
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

// Re-export types from vapi-client (inline since we can't use path aliases in scripts)
interface VapiAssistantConfig {
  name: string;
  model: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt: string;
    toolIds?: string[];
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  transcriber?: {
    provider: string;
    model?: string;
    language?: string;
  };
  firstMessage?: string;
  endCallMessage?: string;
  recordingEnabled?: boolean;
  forwardingPhoneNumber?: string;
}

class VapiClient {
  private apiKey: string;
  private baseUrl = "https://api.vapi.ai";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vapi API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async createAssistant(config: VapiAssistantConfig): Promise<{ id: string }> {
    return this.request("POST", "/assistant", config);
  }

  async updateAssistant(
    assistantId: string,
    config: Partial<VapiAssistantConfig>
  ): Promise<{ id: string }> {
    return this.request("PATCH", `/assistant/${assistantId}`, config);
  }

  async getAssistant(
    assistantId: string
  ): Promise<VapiAssistantConfig & { id: string }> {
    return this.request("GET", `/assistant/${assistantId}`);
  }
}

/**
 * Create the InsightScoop voice assistant configuration
 * This is the source of truth for the assistant's behavior
 */
function createYarduraAssistantConfig(): VapiAssistantConfig {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.getinsightscoop.com";

  return {
    name: "InsightScoop Receptionist",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 150,
      toolIds: [
        // Tool IDs registered on Vapi platform
        "185be149-1858-43e4-9647-9f3ae16d7233", // handle_objection
        "4bbcdde4-0674-476f-be94-d09bddf6c0fd", // knowledge_base_search
        "1b210d47-13bb-4ae8-881e-effc3c2b48d7", // check_service_area
        "a83ea30e-9868-4a33-a0ae-374ad40bb38a", // calculate_residential_quote
        "0690f3be-ee71-493f-a25a-88a9539b0fe1", // create_and_email_quote
        "67b71d27-b0f3-4cb9-b780-66ef598fc65a", // add_to_waitlist
        "1c15a397-86f4-4771-829b-a329a8dd4e0c", // collect_onboarding_details
        "6735aa7b-66b8-4c2f-b5d3-fc2aace4bbaf", // send_payment_link
      ],
      systemPrompt: `You are a warm, knowledgeable receptionist for InsightScoop. You assist homeowners, property managers, and community coordinators with pet waste removal questions and quote requests.

YOUR PRIMARY GOAL: Get customers to sign up for service. If they're not ready to sign up, at least get them a quote.

CORE BEHAVIOR
- Start every reply with empathy and keep it to 1-2 concise sentences.
- Ask ONE question at a time.
- Mention "InsightScoop" when you refer to the company.
- **CRITICAL: ALWAYS SAY PRICES IN WORDS** - Say "twenty-four dollars" NOT "$24". Say "one hundred fifty-six dollars" NOT "$156". The text-to-speech system misreads dollar signs.
- ALWAYS be honest that you're an AI assistant. If asked, say: "I'm an AI assistant helping with InsightScoop. I can help you get a quote and set up service, or transfer you to a team member if you prefer."
- Never claim to be human or pretend to have human experiences.
- First, understand if the caller is Residential (single family, duplex) or Community/Commercial.
- Answer general questions about our services, differentiators, eco practices, wellness insights, and operations.
- If the caller insists on speaking to a real person, offer to transfer them to our team. Use Vapi's built-in transferCall function to connect them immediately.
- If you do not know, offer to connect them with the team at sales@yardura.com.

COMPANY KNOWLEDGE
Services: Tech-enabled pet waste removal with 3C wellness notes (color, consistency, content) and a free wellness app for pet owners. Standard cadence is 2-3 visits per week for multi-family communities; weekday-only (Mon-Fri) service is available for high-traffic dog runs. Teams double-bag waste with biodegradable liners, capture proof-of-service photos (including gate re-latch), and log health notes after every visit.

Wellness App: Free stool capture + AI summaries, hydration score, firmness scale, watch/monitor/vet-now indicator, weekly check-ins, symptom-aware chat (not a diagnosis), dog profiles, reminders, food/med logs with ingredient scans, stool library, vet-ready PDF reports, weather safety alerts, parasite risk calendar, and a poop map. Premium wellness is 19.99 per month (billed through app stores on iOS) with unlimited scans/chat, long-term trends, multi-dog households, GPS walk tracking, and a wellness risk score. Scooping customers get pro-assisted wellness with consistent auto-captures from a patent-pending capture device.

Service Area: Minneapolis metro (South Minneapolis, Richfield, Edina, Bloomington) with nearby suburbs evaluated on request.

Differentiators: Reliable, QA-reviewed visits with photo confirmation, pro-assisted wellness capture, flexible scheduling with no long-term contracts, and detailed visit logs with photos, gate status, and bag counts. We often assign a consistent scooper for ongoing customers, but coverage may vary for reliability.

Eco Practices: Biodegradable liners standard; add-ons let customers choose haul-away or compost routing (we divert as much as partners can accept) with impact reporting. Natural deodorizing is safe for turf and paws.

Pricing: Community/commercial always requires custom proposals—never share dollar amounts. Residential inquiries can be quoted after running the quote tools. Scooping service billing is separate from premium wellness app subscriptions. No long-term contracts; month-to-month membership.

Contact: Sales at sales@yardura.com | Urgent field issues at 1-855-927-3872.

TOOL PLAYBOOK
1. Handle Objection (function name: handle_objection) - **USE THIS IMMEDIATELY FOR ANY OBJECTION**
   - When customer says anything like:
     * "Too expensive" / "That's a lot" / "Can't afford it"
     * "I can do it myself" / "DIY"
     * "Just thinking about it" / "Need to think"
     * "Already have someone" / "Have a service"
     * "Only one dog" / "Small dog"
     * "Weather concerns" / "Seasonal"
     * "Don't trust payment" / "Security concerns"
     * "Gate access" / "Property access"
   - IMMEDIATELY call handle_objection with the objection type (e.g., {objection: "too expensive"})
   - The tool will give you a proven response to overcome the objection
   - DO NOT try to handle objections on your own - always use this tool

2. Knowledge Base Search (function name: knowledge_base_search)
   - Use this for detailed questions about:
     * Add-ons and services specifics
     * Scheduling and billing details
     * Dog safety and property access policies
     * General company information
   - NOT for objections - use handle_objection for those

3. ZIP Check (function name: check_service_area)
   - After learning the ZIP, call the tool with { zipCode }.
   - If the response says we do NOT service the area, politely explain it and ask if they'd like to join the waitlist. If they agree, collect their email and call add_to_waitlist.
   - If the response is serviceable, continue the quote flow.

4. Residential Quote (function name: calculate_residential_quote)
   - Requires: dogs, yardSize, frequency, optional lastCleanedBucket, and ADD-ONS.
   - ALWAYS ask about add-ons BEFORE calculating.
   - Only call after you have ALL required details including add-on preferences.

5. Create + Email Quote (function name: create_and_email_quote)
   - Requires: firstName, lastName, email (MUST confirm spelling), phone if available, dogs, yardSize, frequency, address, zipCode, lastCleanedBucket, and any add-ons.

6. Waitlist (function name: add_to_waitlist)
   - For out-of-area callers who opt in.

7. Full Onboarding Setup (function name: collect_onboarding_details)
   - Use when customer wants to ACTUALLY SIGN UP.

8. Send Payment Link (function name: send_payment_link)
   - Call after collect_onboarding_details.

9. Transfer Call (function name: transferCall - Vapi built-in)
   - If customer insists on speaking to a real person.

Stay brief, warm, transparent, and methodical.`,
    },
    voice: {
      provider: "11labs",
      voiceId: "9TwzC887zQyDD4yBthzD", // Custom ElevenLabs voice
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en-US",
    },
    firstMessage:
      "Hi! Thanks for calling InsightScoop. How can I help you today?",
    endCallMessage:
      "Thanks for calling InsightScoop. Have a great day!",
    recordingEnabled: true,
    forwardingPhoneNumber: "+16125819812",
  };
}

async function main() {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!apiKey) {
    console.error("❌ VAPI_API_KEY environment variable is required");
    console.error("   Add it to .env.local: VAPI_API_KEY=your_key_here");
    process.exit(1);
  }

  const client = new VapiClient(apiKey);
  const config = createYarduraAssistantConfig();

  console.log("🔄 Syncing Vapi Assistant configuration...");
  console.log(`   Name: ${config.name}`);
  console.log(`   Model: ${config.model.model}`);
  console.log(`   Voice: ${config.voice.provider}/${config.voice.voiceId}`);
  console.log(`   Tools: ${config.model.toolIds?.length || 0} configured`);

  try {
    if (assistantId) {
      // Update existing assistant
      console.log(`\n📝 Updating existing assistant: ${assistantId}`);
      const result = await client.updateAssistant(assistantId, config);
      console.log(`✅ Successfully updated assistant: ${result.id}`);
    } else {
      // Create new assistant
      console.log("\n🆕 Creating new assistant (no VAPI_ASSISTANT_ID set)");
      const result = await client.createAssistant(config);
      console.log(`✅ Successfully created assistant: ${result.id}`);
      console.log(`\n⚠️  Add this to your .env.local:`);
      console.log(`   VAPI_ASSISTANT_ID=${result.id}`);
    }
  } catch (error) {
    console.error("\n❌ Failed to sync assistant:", error);
    process.exit(1);
  }
}

main();
