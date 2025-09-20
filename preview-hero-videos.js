#!/usr/bin/env node

/**
 * Hero Video Preview & Selection Tool
 * Helps you choose the best video for your hero section
 */

import fs from "fs";

const videos = [
  {
    file: "hero-option1-couple.mp4",
    title: "Happy Couple with Golden Retriever",
    description:
      "Lifestyle style - Man and woman laughing with golden retriever in clean backyard",
    size: "5.9MB",
  },
  {
    file: "hero-option2-family.mp4",
    title: "Young Family with Children & Labrador",
    description:
      "Commercial style - Kids playing fetch with labrador, parents watching",
    size: "11.0MB",
  },
];

function showVideoOptions() {
  console.log("🎬 Yard Dog Hero Video Options");
  console.log("==============================");
  console.log("");

  videos.forEach((video, index) => {
    const exists = fs.existsSync(`./public/${video.file}`);
    console.log(`${index + 1}. ${video.title}`);
    console.log(`   📁 File: ${video.file} (${video.size})`);
    console.log(`   📝 ${video.description}`);
    console.log(`   ✅ Downloaded: ${exists ? "Yes" : "No"}`);
    console.log("");
  });

  console.log("🎯 To use a video as your hero:");
  console.log("");
  videos.forEach((video, index) => {
    console.log(`Option ${index + 1}:`);
    console.log(`   cp ./public/${video.file} ./public/hero-video.mp4`);
    console.log("");
  });

  console.log("💡 After copying your choice:");
  console.log("   1. Refresh http://localhost:3001 to see the video");
  console.log("   2. Deploy with: ./deploy.sh");
  console.log("");
  console.log("🎨 Video Comparison:");
  console.log("   • Option 1: More intimate, couple-focused, smaller file");
  console.log("   • Option 2: Family-oriented, kids appeal, larger file");
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

if (command === "1") {
  // Copy option 1
  fs.copyFileSync(
    "./public/hero-option1-couple.mp4",
    "./public/hero-video.mp4",
  );
  console.log(
    "✅ Set hero video to Option 1: Happy Couple with Golden Retriever",
  );
  console.log("🔄 Refresh your browser to see the change!");
} else if (command === "2") {
  // Copy option 2
  fs.copyFileSync(
    "./public/hero-option2-family.mp4",
    "./public/hero-video.mp4",
  );
  console.log(
    "✅ Set hero video to Option 2: Young Family with Children & Labrador",
  );
  console.log("🔄 Refresh your browser to see the change!");
} else {
  showVideoOptions();
}
