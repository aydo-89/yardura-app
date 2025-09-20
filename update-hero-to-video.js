#!/usr/bin/env node

/**
 * Hero Component Video Integration Script
 * Automatically updates the hero component to use video instead of static image
 */

import fs from "fs";
import path from "path";

const HERO_COMPONENT_PATH = "./src/components/hero.tsx";

function updateHeroComponent() {
  console.log("🎬 Updating Hero Component to Use Video");
  console.log("=====================================");

  try {
    // Read the current hero component
    const heroContent = fs.readFileSync(HERO_COMPONENT_PATH, "utf8");

    // Check if already using video
    if (heroContent.includes("<video") || heroContent.includes("hero-video")) {
      console.log("✅ Hero component already uses video!");
      return;
    }

    // Replace the Image component with video element
    const updatedContent = heroContent.replace(
      // Find the Image component block
      /<Image\s+src="\/modern_yard\.png"[\s\S]*?\/>/,
      `<video
                  src="/hero-video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-[450px] md:h-[550px] object-cover"
                  poster="/modern_yard.png" // Fallback image while loading
                />`,
    );

    // Write the updated component
    fs.writeFileSync(HERO_COMPONENT_PATH, updatedContent);

    console.log("✅ Hero component updated successfully!");
    console.log("");
    console.log("🎯 Changes made:");
    console.log("  • Replaced Image component with video element");
    console.log("  • Added autoplay, loop, muted attributes");
    console.log("  • Set poster image as fallback");
    console.log("  • Maintained responsive sizing");
    console.log("");
    console.log("📋 Next steps:");
    console.log("  1. Generate a hero video using: node create-hero-video.js");
    console.log("  2. Download the video to /public/hero-video.mp4");
    console.log("  3. Test the hero section locally");
    console.log("  4. Deploy to production");
  } catch (error) {
    console.error("❌ Failed to update hero component:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

// Revert function to go back to static image
function revertToImage() {
  console.log("🖼️ Reverting Hero Component to Static Image");
  console.log("===========================================");

  try {
    const heroContent = fs.readFileSync(HERO_COMPONENT_PATH, "utf8");

    if (!heroContent.includes("<video")) {
      console.log("✅ Hero component already uses static image!");
      return;
    }

    // Replace video element back to Image component
    const updatedContent = heroContent.replace(
      /<video[\s\S]*?\/>/,
      `<Image
                  src="/modern_yard.png"
                  alt="Clean Minneapolis yard after professional dog waste removal service - lush green grass and beautiful landscaping"
                  width={800}
                  height={600}
                  className="w-full h-[450px] md:h-[550px] object-cover"
                  priority // LCP optimization
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAoACgDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMEB//EACUQAAIBAwMEAwEBAAAAAAAAAAECAwAEEQUSITFBURNhcZEigf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A4+iiigAooooAKKKKACiiigD/2Q=="
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />`,
    );

    fs.writeFileSync(HERO_COMPONENT_PATH, updatedContent);

    console.log("✅ Hero component reverted to static image!");
  } catch (error) {
    console.error("❌ Failed to revert hero component:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

if (command === "revert") {
  revertToImage();
} else if (command === "help" || command === "--help" || command === "-h") {
  console.log("🎬 Hero Component Video Integration");
  console.log("==================================");
  console.log("");
  console.log("Usage:");
  console.log("  node update-hero-to-video.js        # Update to use video");
  console.log("  node update-hero-to-video.js revert # Revert to static image");
  console.log("");
  console.log("This script automatically updates src/components/hero.tsx");
  console.log("to use a video element instead of the static image.");
} else {
  updateHeroComponent();
}
