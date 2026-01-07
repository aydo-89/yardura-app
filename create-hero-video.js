#!/usr/bin/env node

/**
 * InsightScoop by Yardura Hero Video Generator
 * Uses Google Veo 3.1 via Replicate API to create hero landing page content
 *
 * Usage: node create-hero-video.js [prompt] [style] [duration]
 * Example: node create-hero-video.js "sky-to-backyard-scroll" cinematic 8
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN || process.env.VITE_REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN not found in environment variables");
  console.log("💡 Add your Replicate API token to .env file:");
  console.log("   REPLICATE_API_TOKEN=your_token_here");
  process.exit(1);
}

// Preset InsightScoop hero video prompts
const INSIGHTSCOOP_PRESETS = {
  "landing-scroll-optimized":
    "Ultra-slow vertical crane shot descending from blue sky with clouds, smoothly tilting down through treetops, revealing clean Minneapolis backyard with native landscaping, continuing down to pristine lawn and modern patio with elegant waste bins, two golden retrievers lounging peacefully, consistent soft lighting, no cuts, single continuous take, professional real estate videography",
  "landing-scroll-alternate":
    "Slow aerial descent starting from bright sky with soft clouds, camera gradually tilts to reveal tree canopy and roofline, smooth vertical movement through garden space with lush native plants, descending to ground level showing immaculate lawn, ending at modern outdoor living area with design-forward patio furniture and waste station, happy dogs relaxing on deck, golden afternoon lighting, single continuous shot, high-end architectural videography",
  "landing-scroll-vibrant":
    "Ultra-slow vertical camera descent starting high above with expansive brilliant blue sky and scattered white puffy clouds on perfect sunny day, gradual downward tilt revealing green tree canopy, continuing smooth descent through lush residential backyard with vibrant green grass and colorful native plantings, camera moving steadily downward to ground level pristine lawn, ending at elegant modern patio with contemporary outdoor furniture and sleek waste management station, two happy golden retrievers resting on patio, consistent bright natural daylight throughout, no cuts, single continuous aerial-to-ground shot, professional luxury real estate cinematography",
  "sky-to-backyard-scroll":
    "Cinematic vertical camera movement starting with perfect blue sky filled with puffy white clouds, slowly tilting and panning downward revealing a lush biodiverse landscaped backyard with native Minnesota plants and flowers, smooth dolly shot descending into the scene, eventually arriving at a cozy modern patio with sleek design-conscious eco-friendly waste bins, immaculately clean manicured yard with healthy green grass, 2-3 happy dogs lounging peacefully on the patio, serene upscale Minneapolis residential setting, golden hour lighting, professional architectural cinematography",
  "clean-yard-transformation":
    "Beautiful Minneapolis backyard transformation from messy to pristine clean, lush green grass, professional dog waste removal service, before and after reveal, clean suburban yard, family-friendly outdoor space",
  "happy-dog-clean-yard":
    "Golden retriever happily playing in a spotless, well-maintained Minneapolis backyard, clean green grass, professional yard care, dog running freely in pristine outdoor space, joyful pet in clean environment",
  "professional-service":
    "Professional dog waste removal service in action, clean Minneapolis yard, uniformed service provider, pristine grass, eco-friendly waste management, suburban home exterior, professional yard maintenance",
  "family-backyard-bliss":
    "Happy family with dog enjoying clean backyard in Minneapolis, children playing safely on pristine grass, dog running freely, clean outdoor living space, suburban family lifestyle",
  "eco-friendly-service":
    "Eco-friendly dog waste removal process, green waste management, sustainable yard care, Minneapolis suburban home, environmental responsibility, clean green outdoor space",
  "yard-health-insights":
    "Smart technology meets yard care, digital health monitoring for pets, clean Minneapolis backyard, tech-enabled pet waste management, modern sustainable living",
};

async function generateHeroVideo(prompt, style = "cinematic", duration = 5) {
  console.log("🌟 InsightScoop by Yardura Hero Video Generator");
  console.log("===============================================");
  console.log(`📝 Prompt: ${prompt}`);
  console.log(`🎨 Style: ${style}`);
  console.log(`⏱️ Duration: ${duration} seconds`);
  console.log(`💰 Estimated cost: ~$0.12-0.15 (Veo 3.1)`);
  console.log("");

  try {
    // Check if prompt is a preset
    const finalPrompt = INSIGHTSCOOP_PRESETS[prompt] || prompt;

    // Enhance prompt with Veo 3.1 optimized techniques
    // For scroll animation, we want continuous camera movement, not close-ups
    const isScrollOptimized = prompt === "landing-scroll-optimized" || prompt === "landing-scroll-alternate" || prompt === "landing-scroll-vibrant";
    const isScrollAnimation = prompt === "sky-to-backyard-scroll" || isScrollOptimized;
    
    let enhancedPrompt;
    if (isScrollOptimized) {
      // Optimized for scroll-triggered background video
      enhancedPrompt = `${finalPrompt}, extremely slow consistent camera speed, clear vertical zones for scroll progression, even exposure throughout, 4K cinematic quality`;
    } else if (isScrollAnimation) {
      enhancedPrompt = `${finalPrompt}, continuous smooth camera tilt from sky to ground, no cuts, single take, seamless transition, professional videography, ultra high definition`;
    } else {
      enhancedPrompt = `${finalPrompt} with cinematic quality, smooth camera movement, bright natural lighting, wide-angle lens capturing suburban Minneapolis setting, professional commercial style, eco-conscious aesthetic, 4K quality`;
    }

    console.log("🚀 Starting hero video generation with Veo 3.1...");
    console.log(`📝 Enhanced prompt: ${enhancedPrompt}`);

    // Create prediction with Veo 3.1
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "google/veo-3", // Google's Veo 3 (use latest available version)
        input: {
          prompt: enhancedPrompt,
          duration: duration,
          aspect_ratio: "16:9", // Perfect for hero sections
          quality: "high",
          seed: Math.floor(Math.random() * 1000000),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Replicate API error: ${response.status} ${response.statusText}`,
      );
    }

    const prediction = await response.json();
    console.log(`⏳ Hero video generation started (ID: ${prediction.id})`);
    console.log("⏱️ This may take 30-120 seconds...");

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 150; // 2.5 minute timeout

    while (
      (result.status === "starting" || result.status === "processing") &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds
      attempts++;

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
        },
      );

      result = await pollResponse.json();

      // Show progress
      if (attempts % 15 === 0) {
        // Every 30 seconds
        console.log(`🔄 Still processing... (${attempts * 2}s elapsed)`);
      }
    }

    if (result.status === "succeeded") {
      console.log("");
      console.log("✅ Hero video generated successfully!");
      console.log(`🎬 Video URL: ${result.output}`);

      // Save video info to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const videoInfo = {
        id: result.id,
        url: result.output,
        prompt: finalPrompt,
        enhancedPrompt: enhancedPrompt,
        style: style,
        duration: duration,
        generatedAt: new Date().toISOString(),
        cost: 0.15,
        model: "Veo 3.1",
        purpose: "hero-landing-page",
        brand: "InsightScoop by Yardura",
      };

      // Create hero-videos directory if it doesn't exist
      const outputDir = "./public/hero-videos";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save video metadata
      const metadataFile = path.join(
        outputDir,
        `insightscoop-hero-${timestamp}.json`,
      );
      fs.writeFileSync(metadataFile, JSON.stringify(videoInfo, null, 2));

      console.log(`📄 Video metadata saved: ${metadataFile}`);
      console.log("");
      console.log("💡 To download the video for hero section:");
      console.log(`   curl -o "./public/hero-scroll-animation.mp4" "${result.output}"`);
      console.log("");
      console.log("🎯 Integration steps for scroll animation:");
      console.log("   1. Download the video using the curl command above");
      console.log(
        "   2. Use as background video in src/components/hero.tsx",
      );
      console.log("   3. Set up scroll-triggered playback for interactive effect");
      console.log(
        "   4. Configure autoplay, loop, muted for seamless background experience",
      );
      console.log("");
      console.log("📋 Hero component update example:");
      console.log("   <video");
      console.log('     src="/hero-scroll-animation.mp4"');
      console.log("     autoPlay");
      console.log("     loop");
      console.log("     muted");
      console.log("     playsInline");
      console.log(
        '     className="w-full h-screen object-cover fixed top-0 left-0 -z-10"',
      );
      console.log("   />");
      console.log("");
      console.log("💡 For scroll-linked playback, use video.currentTime with scroll position");

      return videoInfo;
    } else if (attempts >= maxAttempts) {
      throw new Error("Hero video generation timeout (2.5 minutes)");
    } else {
      throw new Error(
        result.error ||
          `Hero video generation failed with status: ${result.status}`,
      );
    }
  } catch (error) {
    console.error("");
    console.error("❌ Hero video generation failed:");
    console.error(`   ${error.message}`);
    console.error("");
    console.error("🔧 Troubleshooting:");
    console.error("   1. Check your REPLICATE_API_TOKEN in .env");
    console.error("   2. Ensure you have credits in your Replicate account");
    console.error("   3. Try a different preset or simpler prompt");
    console.error("   4. Check network connectivity");
    process.exit(1);
  }
}

// Command line interface
function showHelp() {
  console.log("🌟 InsightScoop by Yardura Hero Video Generator");
  console.log("===============================================");
  console.log("");
  console.log("Usage:");
  console.log("  node create-hero-video.js [prompt] [style] [duration]");
  console.log("");
  console.log("🎯 Recommended presets for hero section:");
  Object.keys(INSIGHTSCOOP_PRESETS).forEach((key) => {
    console.log(`  ${key}`);
  });
  console.log("");
  console.log("🎨 Available styles:");
  console.log("  cinematic    - Smooth, professional, movie-like");
  console.log("  commercial   - Bright, clean, advertising style");
  console.log("  lifestyle    - Natural, authentic, everyday");
  console.log("  documentary  - Realistic, informative");
  console.log("");
  console.log("⏱️ Duration: 3, 5, 8, or 10 seconds (8s recommended for scroll animations)");
  console.log("");
  console.log("💡 Hero section examples:");
  console.log(
    "  node create-hero-video.js sky-to-backyard-scroll cinematic 8",
  );
  console.log(
    "  node create-hero-video.js clean-yard-transformation cinematic 5",
  );
  console.log("  node create-hero-video.js happy-dog-clean-yard commercial 3");
  console.log("  node create-hero-video.js family-backyard-bliss lifestyle 5");
  console.log("");
  console.log("🎬 Best practices for hero videos:");
  console.log("  • Use 8-10 seconds for scroll animations (more content)");
  console.log("  • Use 3-5 seconds for static background videos");
  console.log("  • Always use cinematic style for best quality");
  console.log("  • Veo 3.1 provides improved consistency and realism");
  console.log("  • Ensure Minneapolis/Twin Cities aesthetic");
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  showHelp();
  process.exit(0);
}

const prompt = args[0];
const style = args[1] || "cinematic";
const duration = parseInt(args[2]) || 8;

if (![3, 5, 8, 10].includes(duration)) {
  console.error("❌ Duration must be 3, 5, 8, or 10 seconds");
  console.log("💡 Recommended: 8 seconds for scroll animations, 5 seconds for static backgrounds");
  process.exit(1);
}

if (!["cinematic", "documentary", "commercial", "lifestyle"].includes(style)) {
  console.error(
    "❌ Style must be: cinematic, documentary, commercial, or lifestyle",
  );
  console.log("💡 Recommended: cinematic or commercial for hero sections");
  process.exit(1);
}

// Generate the hero video
generateHeroVideo(prompt, style, duration).catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
