import {createClient} from '@sanity/client'
import fs from 'fs'
import path from 'path'

const client = createClient({
  projectId: 'xvi8q8j2',
  dataset: 'production',
  useCdn: false, // Use direct API for uploads
  apiVersion: '2023-01-01',
  token: process.env.SANITY_API_TOKEN // You'll need to set this
})

const modelFiles = [
  { file: path.resolve('wastewell_only.usdz'), name: 'wastewell_only' },
  { file: path.resolve('wastewell_and_scoop.usdz'), name: 'wastewell_and_scoop' },
  { file: path.resolve('wastewell_and_dolly.usdz'), name: 'wastewell_and_dolly' },
  { file: path.resolve('wastewell_both_scoop_and_dolly.usdz'), name: 'wastewell_both_scoop_and_dolly' }
]

async function uploadModels() {
  console.log('Starting USDZ file uploads to Sanity...\n')
  
  const results = {}
  
  for (const {file, name} of modelFiles) {
    try {
      console.log(`Uploading ${name}...`)
      
      const filePath = path.resolve(file)
      const fileBuffer = fs.readFileSync(filePath)
      
      const asset = await client.assets.upload('file', fileBuffer, {
        filename: `${name}.usdz`,
        contentType: 'model/vnd.usdz+zip'
      })
      
      const cdnUrl = asset.url
      results[name] = cdnUrl
      
      console.log(`✅ ${name}: ${cdnUrl}\n`)
      
    } catch (error) {
      console.error(`❌ Failed to upload ${name}:`, error.message)
    }
  }
  
  console.log('\n🎉 Upload complete! Here are your CDN URLs:')
  console.log(JSON.stringify(results, null, 2))
  
  // Generate JavaScript object for easy copy-paste
  console.log('\n📋 Copy this into your landing.html file:')
  console.log(`
const CDN_URLS = {
  wastewell_only: '${results.wastewell_only}',
  wastewell_and_scoop: '${results.wastewell_and_scoop}',
  wastewell_and_dolly: '${results.wastewell_and_dolly}',
  wastewell_both_scoop_and_dolly: '${results.wastewell_both_scoop_and_dolly}'
}`)
}

uploadModels().catch(console.error) 