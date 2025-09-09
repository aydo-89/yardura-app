# 🎬 WasteWell Marketing Video Generator

Standalone tool for creating professional marketing videos using Google Veo 3 Fast AI via Replicate API.

## 🚀 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Token:**
   Add your Replicate API token to `.env`:
   ```
   REPLICATE_API_TOKEN=your_replicate_token_here
   ```

## 📋 Usage

### Basic Command
```bash
node create-marketing-video.js [prompt] [style] [duration]
```

### Quick Start with Presets
```bash
# Luxury patio scene (5 seconds, cinematic)
node create-marketing-video.js luxury-patio

# Modern deck with commercial style (3 seconds)
node create-marketing-video.js deck-modern commercial 3

# Family backyard scene (10 seconds, lifestyle)
node create-marketing-video.js backyard-family lifestyle 10
```

### Custom Prompts
```bash
# Custom scene description
node create-marketing-video.js "WasteWell station in modern minimalist garden at golden hour" cinematic 5
```

## 🎨 Available Options

### **Preset Prompts:**
- `luxury-patio` - Luxury patio with sunset lighting
- `backyard-family` - Family gathering scene
- `garden-upscale` - Professional landscaping setting
- `deck-modern` - Contemporary deck environment
- `poolside-resort` - Resort-style poolside
- `entertaining` - Outdoor entertainment setup

### **Styles:**
- `cinematic` - Movie-like quality with dramatic lighting
- `commercial` - Professional product showcase style
- `documentary` - Natural, authentic look
- `lifestyle` - Casual, aspirational living

### **Duration:**
- `3` seconds - Quick product shots
- `5` seconds - Standard marketing clips  
- `10` seconds - Extended lifestyle scenes

## 💰 Cost & Performance

- **Cost:** ~$0.10 per video
- **Generation Time:** 30-120 seconds
- **Quality:** 4K, 16:9 aspect ratio
- **Format:** MP4 video file

## 📁 Output

Generated videos are saved with metadata in `./marketing-videos/`:

```
marketing-videos/
├── wastewell-video-2024-01-15T10-30-00-000Z.json  # Metadata
└── (download MP4 using provided curl command)
```

### Metadata includes:
- Video URL for download
- Original and enhanced prompts
- Generation timestamp
- Cost tracking
- Replicate prediction ID

## 🎯 Marketing Use Cases

### **Website Assets:**
```bash
# Hero section background video
node create-marketing-video.js luxury-patio cinematic 5

# Product showcase
node create-marketing-video.js "WasteWell station close-up in elegant setting" commercial 3
```

### **Social Media:**
```bash
# Instagram Stories/Reels
node create-marketing-video.js backyard-family lifestyle 10

# LinkedIn product posts
node create-marketing-video.js deck-modern commercial 5
```

### **Email Marketing:**
```bash
# Newsletter headers
node create-marketing-video.js garden-upscale cinematic 3
```

## 🔧 Troubleshooting

### **Common Issues:**

1. **"REPLICATE_API_TOKEN not found"**
   - Add token to `.env` file
   - Ensure `.env` is in project root

2. **"Video generation timeout"**
   - Try shorter prompts
   - Reduce duration to 3-5 seconds
   - Check Replicate service status

3. **"API error 402"**
   - Add credits to Replicate account
   - Check billing settings

4. **Poor video quality**
   - Use more specific, detailed prompts
   - Include lighting and aesthetic keywords
   - Try different styles

### **Optimization Tips:**

- **Best prompts include:**
  - Specific setting (patio, deck, garden)
  - Lighting conditions (sunset, golden hour)
  - Aesthetic keywords (luxury, modern, elegant)
  - Camera angles (wide shot, close-up)

- **Avoid:**
  - Overly complex scenes
  - Multiple conflicting elements
  - Abstract concepts

## 📈 Batch Generation

Create multiple videos for a campaign:

```bash
# Generate hero videos
node create-marketing-video.js luxury-patio cinematic 5
node create-marketing-video.js poolside-resort cinematic 5

# Generate product focus videos  
node create-marketing-video.js "WasteWell LED illumination close-up" commercial 3
node create-marketing-video.js "WasteWell elegant integration" commercial 3

# Generate lifestyle videos
node create-marketing-video.js backyard-family lifestyle 10
node create-marketing-video.js entertaining lifestyle 10
```

## 🎬 Professional Tips

### **Prompt Engineering:**
- Start with setting/location
- Add WasteWell integration details
- Include aesthetic/mood keywords
- Specify lighting conditions
- Add quality markers (4K, professional, cinematic)

### **Example Professional Prompt:**
```
"WasteWell LED waste station seamlessly integrated into luxury outdoor kitchen patio at golden hour, warm ambient lighting, premium outdoor furniture, professional architectural photography style, 4K cinematic quality"
```

### **Style Guidelines:**
- **Cinematic:** Use for hero content, emotional storytelling
- **Commercial:** Use for product features, direct marketing
- **Documentary:** Use for authentic, lifestyle content
- **Lifestyle:** Use for aspirational, social media content

## 🔗 Integration with Website

1. Generate videos using this tool
2. Download and optimize for web (compress if needed)
3. Upload to hosting (S3, CDN, etc.)
4. Integrate into website assets:
   - Hero section backgrounds
   - Product gallery videos
   - Email marketing assets
   - Social media content

---

**Need help?** Check the Replicate API documentation or contact support with specific error messages and prompt details. 