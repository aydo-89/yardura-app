/**
 * DepthAnything V2 + Replicate API Proxy Server
 * 
 * This Express server provides access to:
 * - DepthAnything V2 via Hugging Face Inference API (primary)
 * - DepthAnything V2 via Hugging Face Spaces (fallback)
 * - Google Veo 3 Fast video generation via Replicate
 * 
 * Usage:
 * 1. npm install express cors dotenv
 * 2. Add HUGGINGFACE_API_TOKEN to your .env file (optional, uses free tier as fallback)
 * 3. Add REPLICATE_API_TOKEN to your .env file (for video generation)
 * 4. node replicate-proxy.js
 * 5. Frontend calls localhost:3001/api/depth for DepthAnything V2
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3001

// Enable CORS and JSON parsing
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Replicate Proxy Server Running',
    timestamp: new Date().toISOString()
  })
})

// Depth estimation endpoint - UPGRADED to DepthAnything V2 via Hugging Face
app.post('/api/depth', async (req, res) => {
  console.log('🎯 Processing image...')
  
  try {
    const { image } = req.body
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' })
    }
    
    // Convert base64 to binary for Hugging Face API
    const imageData = image.replace(/^data:image\/[a-z]+;base64,/, '')
    const imageBuffer = Buffer.from(imageData, 'base64')
    
    console.log('📤 Processing depth estimation...')
    
    const response = await fetch('https://api-inference.huggingface.co/models/depth-anything/Depth-Anything-V2-Large-hf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN || process.env.HF_API_KEY || process.env.HG_API_KEY || 'hf_demo_token'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: image
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Processing error: ${response.status}`)
      
      // If no token, suggest using Hugging Face Spaces instead
      if (response.status === 401) {
        console.log('💡 Trying alternative processing method...')
        return await processWithHuggingFaceSpaces(image, res)
      }
      
      throw new Error(`Processing error: ${response.status}`)
    }
    
    const result = await response.arrayBuffer()
    const base64Result = Buffer.from(result).toString('base64')
    
    console.log('✅ DepthAnything V2 processing complete!')
    
    res.json({
      status: 'succeeded',
      output: [`data:image/png;base64,${base64Result}`],
      depth_map: `data:image/png;base64,${base64Result}`,
      model: 'DepthAnything-V2-Large-hf',
      provider: 'HuggingFace'
    })
    
  } catch (error) {
    console.error('❌ Processing error:', error)
    
    // Fallback to alternative processing method
    console.log('🔄 Trying alternative processing method...')
    return await processWithHuggingFaceSpaces(req.body.image, res)
  }
})

// Fallback function using Hugging Face Spaces
async function processWithHuggingFaceSpaces(image, res) {
  try {
    console.log('🌐 Using alternative processing...')
    
    // Use the public Depth Anything V2 Space
    const spaceResponse = await fetch('https://depth-anything-depth-anything-v2.hf.space/api/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [image]
      })
    })
    
    if (!spaceResponse.ok) {
      throw new Error(`Spaces API error: ${spaceResponse.status}`)
    }
    
    const spaceResult = await spaceResponse.json()
    console.log('✅ Spaces processing complete!')
    
    res.json({
      status: 'succeeded',
      output: [spaceResult.data[0]],
      depth_map: spaceResult.data[0],
      model: 'DepthAnything-V2-Spaces',
      provider: 'HuggingFace-Spaces'
    })
    
  } catch (spacesError) {
    console.error('❌ Spaces fallback failed:', spacesError)
    res.status(500).json({ 
      error: 'All DepthAnything V2 methods failed',
      details: spacesError.message
    })
  }
}

// Google Veo 3 Fast video generation endpoint
app.post('/api/veo3-video', async (req, res) => {
  try {
    const { prompt, style, duration, aspectRatio } = req.body
    
    if (!prompt) {
      return res.status(400).json({ error: 'Video prompt required' })
    }
    
    const apiKey = process.env.REPLICATE_API_TOKEN || process.env.VITE_REPLICATE_API_TOKEN
    if (!apiKey) {
      return res.status(500).json({ error: 'Replicate API key not configured' })
    }
    
    console.log('🎬 Generating video with Veo 3 Fast...')
    console.log('📝 Prompt:', prompt)
    
    // Create prediction for Veo 3 Fast
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "google/veo-3-fast:latest", // Veo 3 Fast model
        input: {
          prompt: prompt,
          style: style || "cinematic",
          duration: duration || 3, // 3 seconds
          aspect_ratio: aspectRatio || "16:9"
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`)
    }
    
    const prediction = await response.json()
    console.log('⏳ Video generation started, polling for completion...')
    
    // Poll for completion (Veo 3 can take 30-120 seconds)
    let result = prediction
    let attempts = 0
    const maxAttempts = 150 // 2.5 minute timeout for video generation
    
    while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Check every 2 seconds
      attempts++
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      })
      
      result = await pollResponse.json()
      console.log(`🎬 Video Status: ${result.status} (${attempts}/${maxAttempts})`)
    }
    
    if (result.status === 'succeeded') {
      console.log('✅ Video generated successfully!')
      res.json({
        success: true,
        videoUrl: result.output,
        predictionId: result.id,
        duration: duration,
        prompt: prompt
      })
    } else if (attempts >= maxAttempts) {
      res.status(408).json({ error: 'Video generation timeout' })
    } else {
      res.status(500).json({ error: result.error || 'Video generation failed' })
    }
    
  } catch (error) {
    console.error('❌ Video generation error:', error)
    res.status(500).json({ 
      error: 'Failed to generate video',
      details: error.message
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 DepthAnything V2 + Replicate Proxy Server running on http://localhost:${PORT}`)
  console.log(`🎯 DepthAnything V2 API: http://localhost:${PORT}/api/depth`)
  console.log(`🎬 Video API: http://localhost:${PORT}/api/veo3-video`)
  console.log(`🔑 HuggingFace Token: ${process.env.HUGGINGFACE_API_TOKEN || process.env.HF_API_KEY || process.env.HG_API_KEY ? '✅ Found' : '⚠️  Missing (will use free tier)'}`)
  console.log(`🔑 Replicate Token: ${process.env.REPLICATE_API_TOKEN ? '✅ Found' : '❌ Missing'}`)
  console.log(`🎯 DepthAnything V2: State-of-the-art depth estimation (10x better than MiDaS)`)
}) 