#!/usr/bin/env node

/**
 * Landing Page Visual Content Generator
 * Creates images and videos for text-heavy sections to improve engagement
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN not found in environment variables");
  process.exit(1);
}

// Visual content presets for landing page sections
const SECTION_VISUALS = {
  // Differentiators section
  "tech-insights":
    "Modern smartphone showing dog health app with colorful charts and data, clean Minneapolis backyard in background, technology meets pet care, professional service aesthetic",
  "reliable-service":
    "Professional service provider in uniform with equipment in clean suburban Minneapolis yard, reliable weekly service, trustworthy and dependable aesthetic",
  "eco-friendly":
    "Eco-friendly dog waste management process, green composting bins, sustainable practices, environmental responsibility, clean outdoor setting",

  // Services/How It Works section
  "service-step1":
    "Professional arriving at Minneapolis suburban home with service equipment, friendly service provider, clean uniform, reliable first impression",
  "service-step2":
    "Thorough yard cleanup process in action, professional tools, attention to detail, clean suburban backyard transformation",
  "service-step3":
    "Digital health insights being recorded on tablet, modern technology integration, data collection for pet wellness",

  // Eco section
  "environmental-impact":
    "Small-scale composting operation in clean Minneapolis suburban backyard, eco-friendly composting bins, sustainable pet waste management, green community garden setting, professional composting facility, environmental responsibility, organic waste transformation to nutrient-rich compost",
  "waste-diversion":
    "Composting process visualization, organic waste transformation, circular economy, environmental sustainability",

  // Why It Matters (simplified)
  "peace-of-mind":
    "Happy pet owner receiving health notification on phone, peace of mind technology, early detection benefits, positive health monitoring",
  "vet-conversation":
    "Pet owner having positive conversation with veterinarian, health data sharing, proactive pet care, professional consultation",

  // Pricing section
  "value-proposition":
    "Clean yard transformation showing value of service, before and after comparison, investment in yard and pet health",

  // Testimonials/Social Proof
  "happy-customers":
    "Real family photos with dogs in clean suburban Minneapolis yards, genuine smiles, authentic customer satisfaction, natural lighting, professional but warm atmosphere, diverse families enjoying their yards",
};

async function generateSectionVisual(
  preset,
  type = "image",
  style = "commercial",
) {
  console.log(`🎨 Generating ${type} for: ${preset}`);
  console.log("================================");

  const prompt = SECTION_VISUALS[preset];
  if (!prompt) {
    console.error(`❌ Preset '${preset}' not found`);
    return;
  }

  // Enhance prompt for brand consistency
  const enhancedPrompt = `${prompt}. Yard Dog by Yardura branding, Minneapolis Twin Cities suburban setting, professional quality, bright natural lighting, clean aesthetic, family-friendly, modern lifestyle, 4K quality`;

  try {
    const modelVersion =
      type === "video" ? "google/veo-3" : "black-forest-labs/flux-schnell";

    const input =
      type === "video"
        ? {
            prompt: enhancedPrompt,
            duration: 3,
            aspect_ratio: "16:9",
            quality: "high",
          }
        : {
            prompt: enhancedPrompt,
            aspect_ratio: "16:9",
            output_format: "webp",
            output_quality: 90,
          };

    console.log(`🚀 Starting ${type} generation...`);
    console.log(`📝 Prompt: ${enhancedPrompt}`);

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: modelVersion,
        input: input,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Replicate API error: ${response.status} ${response.statusText}`,
      );
    }

    const prediction = await response.json();
    console.log(`⏳ Generation started (ID: ${prediction.id})`);

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = type === "video" ? 150 : 60;

    while (
      (result.status === "starting" || result.status === "processing") &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
        },
      );

      result = await pollResponse.json();

      if (attempts % 15 === 0) {
        console.log(`🔄 Still processing... (${attempts * 2}s elapsed)`);
      }
    }

    if (result.status === "succeeded") {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const extension = type === "video" ? "mp4" : "webp";
      const filename = `section-${preset}-${timestamp}.${extension}`;

      console.log("✅ Generation successful!");
      console.log(
        `🎨 ${type.charAt(0).toUpperCase() + type.slice(1)} URL: ${result.output}`,
      );
      console.log("");
      console.log(`💡 To download for section use:`);
      console.log(
        `   curl -o "./public/sections/${filename}" "${result.output}"`,
      );
      console.log("");
      console.log("🎯 Integration suggestions:");
      console.log(
        `   • Add to ${preset} section as background or feature image`,
      );
      console.log(`   • Use as visual enhancement for text content`);
      console.log(`   • Consider as hero background option`);

      // Save metadata
      const outputDir = "./public/sections";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const metadataFile = path.join(outputDir, `${preset}-${timestamp}.json`);
      fs.writeFileSync(
        metadataFile,
        JSON.stringify(
          {
            id: result.id,
            url: result.output,
            preset: preset,
            type: type,
            prompt: prompt,
            enhancedPrompt: enhancedPrompt,
            filename: filename,
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );

      return { url: result.output, filename };
    } else {
      throw new Error(
        result.error || `Generation failed with status: ${result.status}`,
      );
    }
  } catch (error) {
    console.error(`❌ Failed to generate ${type}:`, error.message);
    process.exit(1);
  }
}

// Show available presets
function showPresets() {
  console.log("🎨 Landing Page Visual Content Generator");
  console.log("=======================================");
  console.log("");
  console.log("📋 Available section presets:");
  console.log("");

  const categories = {
    Differentiators: ["tech-insights", "reliable-service", "eco-friendly"],
    "Services/Process": ["service-step1", "service-step2", "service-step3"],
    Environmental: ["environmental-impact", "waste-diversion"],
    "Health/Wellness": ["peace-of-mind", "vet-conversation"],
    "Social Proof": ["happy-customers", "value-proposition"],
  };

  Object.entries(categories).forEach(([category, presets]) => {
    console.log(`${category}:`);
    presets.forEach((preset) => {
      console.log(
        `  ${preset} - ${SECTION_VISUALS[preset].substring(0, 60)}...`,
      );
    });
    console.log("");
  });

  console.log("💡 Usage:");
  console.log("  node create-section-visuals.js [preset] [type] [style]");
  console.log("");
  console.log("📷 Types: image (default), video");
  console.log("🎨 Styles: commercial (default), lifestyle, cinematic");
  console.log("");
  console.log("🎯 Examples:");
  console.log(
    "  node create-section-visuals.js tech-insights image commercial",
  );
  console.log("  node create-section-visuals.js service-step1 video lifestyle");
  console.log(
    "  node create-section-visuals.js happy-customers image commercial",
  );
}

// Generate multiple visuals for complete landing page refresh
async function generateLandingPageSet() {
  console.log("🚀 Generating Complete Landing Page Visual Set");
  console.log("==============================================");

  const essentialVisuals = [
    { preset: "tech-insights", type: "image", priority: "high" },
    { preset: "reliable-service", type: "image", priority: "high" },
    { preset: "service-step1", type: "image", priority: "medium" },
    { preset: "environmental-impact", type: "image", priority: "medium" },
    { preset: "happy-customers", type: "image", priority: "high" },
  ];

  console.log(`📊 Generating ${essentialVisuals.length} essential visuals...`);
  console.log("💰 Estimated cost: ~$0.50");
  console.log("");

  for (const visual of essentialVisuals) {
    try {
      await generateSectionVisual(visual.preset, visual.type);
      console.log(`✅ Generated: ${visual.preset}`);
      console.log("");
    } catch (error) {
      console.error(`❌ Failed: ${visual.preset} - ${error.message}`);
    }
  }

  console.log("🎉 Landing page visual set complete!");
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  showPresets();
} else if (args[0] === "batch") {
  generateLandingPageSet();
} else {
  const preset = args[0];
  const type = args[1] || "image";
  const style = args[2] || "commercial";

  if (!SECTION_VISUALS[preset]) {
    console.error(`❌ Unknown preset: ${preset}`);
    console.log("💡 Run without arguments to see available presets");
    process.exit(1);
  }

  generateSectionVisual(preset, type, style);
}
