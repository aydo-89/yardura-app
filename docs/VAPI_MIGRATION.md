# Vapi Migration Guide

This document describes the migration from our custom Twilio Media Streams voice agent to Vapi's managed voice agent platform.

## Why Vapi?

**Problems with custom solution:**
- Complex debugging (STT, TTS, interruptions, RAG injection)
- Maintenance overhead (handling edge cases, model changes)
- Time-consuming troubleshooting

**Benefits of Vapi:**
- ✅ Production-ready infrastructure
- ✅ Built-in interruption handling
- ✅ Automatic STT/TTS optimization
- ✅ Easy assistant updates via API
- ✅ Call monitoring dashboard
- ✅ Cost-effective (~$0.05-0.10/min)

## Migration Steps

### 1. Sign up for Vapi

1. Go to https://vapi.ai
2. Sign up for an account
3. Navigate to Settings → API Keys
4. Create a new API key

### 2. Configure Environment Variables

Add to `.env.local`:

```bash
VAPI_API_KEY=your_vapi_api_key_here
```

### 3. Set up Your Assistant

Run the automated setup script:

```bash
npm run setup-vapi
```

This will:
- Create the Yardura Commercial assistant
- Link it to your phone number
- Output the configuration

### 4. Import Your Twilio Number (Optional)

If you want to keep your existing 1-877-417-YARD number:

1. Go to https://dashboard.vapi.ai/phone-numbers
2. Click "Import Twilio Number"
3. Enter your Twilio credentials
4. Select 1-877-417-YARD
5. The script will automatically link it to your assistant

OR

1. Buy a new number through Vapi
2. Update your marketing materials

### 5. Test the Agent

Call your number and test:
- Greeting message
- Question answering
- Interruptions (talk over the AI)
- Call quality

### 6. Monitor Calls

View call logs and transcripts at:
https://dashboard.vapi.ai/calls

## Configuration

### Assistant Settings

The assistant is configured in `src/lib/voice/vapi-client.ts`:

```typescript
{
  name: "Yardura Commercial Receptionist",
  model: {
    provider: "openai",
    model: "gpt-5-mini", // Fast and cost-effective
    temperature: 0.7,
    maxTokens: 100,
    systemPrompt: "..." // Your conversational prompt
  },
  voice: {
    provider: "11labs",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ" // Liam voice
  },
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en-US"
  }
}
```

### Updating the Assistant

To update the assistant (e.g., change the prompt):

1. Edit `src/lib/voice/vapi-client.ts`
2. Run:
```bash
tsx -e "
import { VapiClient, createYarduraAssistantConfig } from './src/lib/voice/vapi-client';
const vapi = new VapiClient();
const config = createYarduraAssistantConfig();
await vapi.updateAssistant('your_assistant_id', config);
console.log('✅ Assistant updated!');
"
```

OR update directly in the Vapi dashboard:
https://dashboard.vapi.ai/assistants

## Cost Comparison

### Custom Solution
- Deepgram STT: $0.0043/min
- ElevenLabs TTS: $0.018/min (~$1.08/hr)
- Groq LLM: $0.001/min
- Infrastructure: Time + monitoring
- **Total: ~$0.023/min + engineering time**

### Vapi Solution
- All-in-one: $0.05-0.10/min
- No infrastructure management
- **Total: $0.05-0.10/min, zero engineering time**

**Verdict:** Vapi saves 10+ hours of engineering time per month for a minimal cost increase.

## Cleanup (After Migration)

Once Vapi is working, you can optionally remove the old voice agent:

```bash
# Stop the old voice agent
ssh root@159.223.197.13 'pm2 delete yardura-voice-agent && pm2 save'

# Remove Twilio webhook (or keep for fallback)
# Update Twilio voice URL to point to Vapi's webhook
```

## Rollback Plan

If you need to rollback to the custom solution:

1. Re-enable PM2 voice agent: `pm2 start yardura-voice-agent`
2. Update Twilio webhook back to: `https://www.getinsightscoop.com/api/twilio/voice/inbound`
3. Restart Nginx: `systemctl restart nginx`

## Support

- **Vapi Docs:** https://docs.vapi.ai
- **Vapi Discord:** https://discord.gg/vapi
- **Vapi Support:** support@vapi.ai




