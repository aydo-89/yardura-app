#!/usr/bin/env node

/**
 * YardDog by Yardura Hero Video Generator
 * Uses Google Veo 3 Fast via Replicate API to create hero landing page content
 * 
 * Usage: node create-hero-video.js [prompt] [style] [duration]
 * Example: node create-hero-video.js "clean-yard-transformation" cinematic 5
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

// Preset Yard Dog hero video prompts
const YARD_DOG_PRESETS = {
  'clean-yard-transformation': 'Beautiful Minneapolis backyard transformation from messy to pristine clean, lush green grass, professional dog waste removal service, before and after reveal, clean suburban yard, family-friendly outdoor space',
  'happy-dog-clean-yard': 'Golden retriever happily playing in a spotless, well-maintained Minneapolis backyard, clean green grass, professional yard care, dog running freely in pristine outdoor space, joyful pet in clean environment',
  'professional-service': 'Professional dog waste removal service in action, clean Minneapolis yard, uniformed service provider, pristine grass, eco-friendly waste management, suburban home exterior, professional yard maintenance',
  'family-backyard-bliss': 'Happy family with dog enjoying clean backyard in Minneapolis, children playing safely on pristine grass, dog running freely, clean outdoor living space, suburban family lifestyle',
  'eco-friendly-service': 'Eco-friendly dog waste removal process, green waste management, sustainable yard care, Minneapolis suburban home, environmental responsibility, clean green outdoor space',
  'yard-health-insights': 'Smart technology meets yard care, digital health monitoring for pets, clean Minneapolis backyard, tech-enabled pet waste management, modern sustainable living'
}

async function generateHeroVideo(prompt, style = 'cinematic', duration = 5) {
  console.log('🐕 YardDog by Yardura Hero Video Generator')
  console.log('==========================================')
  console.log(`📝 Prompt: ${prompt}`)
  console.log(`🎨 Style: ${style}`)
  console.log(`⏱️ Duration: ${duration} seconds`)
  console.log(`💰 Estimated cost: ~$0.10`)
  console.log('')

  try {
    // Check if prompt is a preset
    const finalPrompt = YARD_DOG_PRESETS[prompt] || prompt

    // Enhance prompt with Veo 3 optimized techniques from Google's guide
    const enhancedPrompt = `Close-up shot of ${finalPrompt} with cinematic quality, smooth dolly shot camera movement, bright natural lighting, shallow focus on foreground, wide-angle lens capturing suburban Minneapolis setting, professional commercial style, eco-conscious aesthetic, 4K quality`

    console.log('🚀 Starting hero video generation...')
    console.log(`📝 Enhanced prompt: ${enhancedPrompt}`)

    // Create prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "google/veo-3", // Google's Veo 3 with audio
        input: {
          prompt: enhancedPrompt,
          duration: duration,
          aspect_ratio: "16:9", // Perfect for hero sections
          quality: "high",
          seed: Math.floor(Math.random() * 1000000)
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status} ${response.statusText}`)
    }

    const prediction = await response.json()
    console.log(`⏳ Hero video generation started (ID: ${prediction.id})`)
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
      console.log('✅ Hero video generated successfully!')
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
        cost: 0.10,
        purpose: 'hero-landing-page',
        brand: 'YardDog by Yardura'
      }

      // Create hero-videos directory if it doesn't exist
      const outputDir = './public/hero-videos'
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // Save video metadata
      const metadataFile = path.join(outputDir, `yard-dog-hero-${timestamp}.json`)
      fs.writeFileSync(metadataFile, JSON.stringify(videoInfo, null, 2))
      
      console.log(`📄 Video metadata saved: ${metadataFile}`)
      console.log('')
      console.log('💡 To download the video for hero section:')
      console.log(`   curl -o "./public/hero-video.mp4" "${result.output}"`)
      console.log('')
      console.log('🎯 Integration steps:')
      console.log('   1. Download the video using the curl command above')
      console.log('   2. Replace the Image component in src/components/hero.tsx')
      console.log('   3. Update the component to use <video> element instead')
      console.log('   4. Set autoplay, loop, muted for seamless hero experience')
      console.log('')
      console.log('📋 Hero component update example:')
      console.log('   <video')
      console.log('     src="/hero-video.mp4"')
      console.log('     autoPlay')
      console.log('     loop')
      console.log('     muted')
      console.log('     playsInline')
      console.log('     className="w-full h-[450px] md:h-[550px] object-cover"')
      console.log('   />')

      return videoInfo

    } else if (attempts >= maxAttempts) {
      throw new Error('Hero video generation timeout (2.5 minutes)')
    } else {
      throw new Error(result.error || `Hero video generation failed with status: ${result.status}`)
    }

  } catch (error) {
    console.error('')
    console.error('❌ Hero video generation failed:')
    console.error(`   ${error.message}`)
    console.error('')
    console.error('🔧 Troubleshooting:')
    console.error('   1. Check your REPLICATE_API_TOKEN in .env')
    console.error('   2. Ensure you have credits in your Replicate account')
    console.error('   3. Try a different preset or simpler prompt')
    console.error('   4. Check network connectivity')
    process.exit(1)
  }
}

// Command line interface
function showHelp() {
  console.log('🐕 YardDog by Yardura Hero Video Generator')
  console.log('==========================================')
  console.log('')
  console.log('Usage:')
  console.log('  node create-hero-video.js [prompt] [style] [duration]')
  console.log('')
  console.log('🎯 Recommended presets for hero section:')
  Object.keys(YARD_DOG_PRESETS).forEach(key => {
    console.log(`  ${key}`)
  })
  console.log('')
  console.log('🎨 Available styles:')
  console.log('  cinematic    - Smooth, professional, movie-like')
  console.log('  commercial   - Bright, clean, advertising style')
  console.log('  lifestyle    - Natural, authentic, everyday')
  console.log('  documentary  - Realistic, informative')
  console.log('')
  console.log('⏱️ Duration: 3, 5, or 10 seconds (5s recommended for hero)')
  console.log('')
  console.log('💡 Hero section examples:')
  console.log('  node create-hero-video.js clean-yard-transformation cinematic 5')
  console.log('  node create-hero-video.js happy-dog-clean-yard commercial 3')
  console.log('  node create-hero-video.js family-backyard-bliss lifestyle 5')
  console.log('')
  console.log('🎬 Best practices for hero videos:')
  console.log('  • Keep it 3-5 seconds for optimal loading')
  console.log('  • Use cinematic or commercial style')
  console.log('  • Focus on transformation or happy outcomes')
  console.log('  • Ensure Minneapolis/Twin Cities aesthetic')
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
  console.log('💡 Recommended: 5 seconds for hero sections')
  process.exit(1)
}

if (!['cinematic', 'documentary', 'commercial', 'lifestyle'].includes(style)) {
  console.error('❌ Style must be: cinematic, documentary, commercial, or lifestyle')
  console.log('💡 Recommended: cinematic or commercial for hero sections')
  process.exit(1)
}

// Generate the hero video
generateHeroVideo(prompt, style, duration)
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })
