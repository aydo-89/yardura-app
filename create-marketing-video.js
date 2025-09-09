#!/usr/bin/env node

/**
 * WasteWell Marketing Video Generator
 * Uses Google Veo 3 Fast via Replicate API to create marketing content
 * 
 * Usage: node create-marketing-video.js [prompt] [style] [duration]
 * Example: node create-marketing-video.js "luxury patio" cinematic 5
 */

import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || process.env.VITE_REPLICATE_API_TOKEN

if (!REPLICATE_API_TOKEN) {
  console.error('❌ REPLICATE_API_TOKEN not found in environment variables')
  console.log('💡 Add your Replicate API token to .env file:')
  console.log('   REPLICATE_API_TOKEN=your_token_here')
  process.exit(1)
}

// Preset WasteWell marketing prompts
const WASTEWELL_PRESETS = {
  'luxury-patio': 'WasteWell LED waste station illuminating a luxury patio at sunset, elegant outdoor living space with modern furniture, premium aesthetic, cinematic lighting',
  'backyard-family': 'Beautiful backyard scene with WasteWell waste station, family gathering, clean and premium aesthetic, outdoor entertaining',
  'garden-upscale': 'WasteWell waste station in upscale garden setting, professional landscaping, premium outdoor design, elegant placement',
  'deck-modern': 'Modern deck lifestyle shot with WasteWell station, entertaining space, elegant evening lighting, contemporary outdoor living',
  'poolside-resort': 'Resort-style poolside setting with WasteWell waste station, luxury outdoor living, premium backyard design',
  'entertaining': 'Outdoor entertaining setup with WasteWell station, guests enjoying premium outdoor space, elegant yard design'
}

async function generateMarketingVideo(prompt, style = 'cinematic', duration = 5) {
  console.log('🎬 WasteWell Marketing Video Generator')
  console.log('=====================================')
  console.log(`📝 Prompt: ${prompt}`)
  console.log(`🎨 Style: ${style}`)
  console.log(`⏱️ Duration: ${duration} seconds`)
  console.log(`💰 Estimated cost: ~$0.10`)
  console.log('')

  try {
    // Check if prompt is a preset
    const finalPrompt = WASTEWELL_PRESETS[prompt] || prompt

    // Enhance prompt with quality keywords
    const enhancedPrompt = `${finalPrompt}. High-quality, professional product showcase, premium outdoor living aesthetic, cinematic lighting, 4K quality, marketing video`

    console.log('🚀 Starting video generation...')
    console.log(`📝 Enhanced prompt: ${enhancedPrompt}`)

    // Create prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "google/veo-3-fast:latest", // Veo 3 Fast
        input: {
          prompt: enhancedPrompt,
          style: style,
          duration: duration,
          aspect_ratio: "16:9",
          quality: "high"
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status} ${response.statusText}`)
    }

    const prediction = await response.json()
    console.log(`⏳ Video generation started (ID: ${prediction.id})`)
    console.log('⏱️ This may take 30-120 seconds...')

    // Poll for completion
    let result = prediction
    let attempts = 0
    const maxAttempts = 150 // 2.5 minute timeout

    while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Check every 2 seconds
      attempts++

      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`
        }
      })

      result = await pollResponse.json()
      
      // Show progress
      if (attempts % 15 === 0) { // Every 30 seconds
        console.log(`🔄 Still processing... (${attempts * 2}s elapsed)`)
      }
    }

    if (result.status === 'succeeded') {
      console.log('')
      console.log('✅ Video generated successfully!')
      console.log(`🎬 Video URL: ${result.output}`)
      
      // Save video info to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const videoInfo = {
        id: result.id,
        url: result.output,
        prompt: finalPrompt,
        enhancedPrompt: enhancedPrompt,
        style: style,
        duration: duration,
        generatedAt: new Date().toISOString(),
        cost: 0.10
      }

      // Create marketing-videos directory if it doesn't exist
      const outputDir = './marketing-videos'
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // Save video metadata
      const metadataFile = path.join(outputDir, `wastewell-video-${timestamp}.json`)
      fs.writeFileSync(metadataFile, JSON.stringify(videoInfo, null, 2))
      
      console.log(`📄 Video metadata saved: ${metadataFile}`)
      console.log('')
      console.log('💡 To download the video:')
      console.log(`   curl -o "wastewell-video-${timestamp}.mp4" "${result.output}"`)
      console.log('')
      console.log('🎯 Next steps:')
      console.log('   1. Download the video using the curl command above')
      console.log('   2. Review and edit as needed')
      console.log('   3. Upload to website assets or marketing materials')

      return videoInfo

    } else if (attempts >= maxAttempts) {
      throw new Error('Video generation timeout (2.5 minutes)')
    } else {
      throw new Error(result.error || `Video generation failed with status: ${result.status}`)
    }

  } catch (error) {
    console.error('')
    console.error('❌ Video generation failed:')
    console.error(`   ${error.message}`)
    console.error('')
    console.error('🔧 Troubleshooting:')
    console.error('   1. Check your REPLICATE_API_TOKEN in .env')
    console.error('   2. Ensure you have credits in your Replicate account')
    console.error('   3. Try a shorter, simpler prompt')
    process.exit(1)
  }
}

// Command line interface
function showHelp() {
  console.log('🎬 WasteWell Marketing Video Generator')
  console.log('=====================================')
  console.log('')
  console.log('Usage:')
  console.log('  node create-marketing-video.js [prompt] [style] [duration]')
  console.log('')
  console.log('Available presets (use as prompt):')
  Object.keys(WASTEWELL_PRESETS).forEach(key => {
    console.log(`  ${key}`)
  })
  console.log('')
  console.log('Available styles:')
  console.log('  cinematic, documentary, commercial, lifestyle')
  console.log('')
  console.log('Duration: 3, 5, or 10 seconds')
  console.log('')
  console.log('Examples:')
  console.log('  node create-marketing-video.js luxury-patio cinematic 5')
  console.log('  node create-marketing-video.js "WasteWell in modern backyard" commercial 3')
  console.log('  node create-marketing-video.js backyard-family lifestyle 10')
}

// Main execution
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  showHelp()
  process.exit(0)
}

const prompt = args[0]
const style = args[1] || 'cinematic'
const duration = parseInt(args[2]) || 5

if (![3, 5, 10].includes(duration)) {
  console.error('❌ Duration must be 3, 5, or 10 seconds')
  process.exit(1)
}

if (!['cinematic', 'documentary', 'commercial', 'lifestyle'].includes(style)) {
  console.error('❌ Style must be: cinematic, documentary, commercial, or lifestyle')
  process.exit(1)
}

// Generate the video
generateMarketingVideo(prompt, style, duration)
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  }) 