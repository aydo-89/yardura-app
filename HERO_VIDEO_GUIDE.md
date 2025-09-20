# 🎬 YardDog Hero Video System

This system replaces the static hero image with dynamic AI-generated videos to create a more engaging landing page experience.

## 🚀 Quick Start

### 1. Set up your Replicate API token
```bash
# Add to your .env file
REPLICATE_API_TOKEN=your_replicate_token_here
```

### 2. Generate a hero video
```bash
# Using npm scripts (recommended)
npm run hero:video clean-yard-transformation cinematic 5

# Or directly
node create-hero-video.js clean-yard-transformation cinematic 5
```

### 3. Download and integrate
```bash
# Download the generated video
curl -o "./public/hero-video.mp4" "VIDEO_URL_FROM_SCRIPT_OUTPUT"

# Update hero component to use video
npm run hero:update
```

### 4. Deploy
```bash
./deploy.sh
```

## 🎯 Available Presets

Perfect for YardDog by Yardura branding:

- **`clean-yard-transformation`** - Before/after yard transformation (recommended)
- **`happy-dog-clean-yard`** - Dog playing in pristine yard
- **`professional-service`** - Service provider in action
- **`family-backyard-bliss`** - Family enjoying clean outdoor space
- **`eco-friendly-service`** - Sustainable waste management focus
- **`yard-health-insights`** - Tech-enabled pet health monitoring

## 🎨 Styles & Settings

### Styles
- **`cinematic`** - Smooth, professional (recommended for hero)
- **`commercial`** - Bright, clean advertising style
- **`lifestyle`** - Natural, authentic everyday moments
- **`documentary`** - Realistic, informative approach

### Duration
- **3 seconds** - Quick, punchy impact
- **5 seconds** - Perfect balance (recommended)
- **10 seconds** - Detailed storytelling

## 📋 Commands Reference

```bash
# Generate hero video with preset
npm run hero:video [preset] [style] [duration]

# Update hero component to use video
npm run hero:update

# Revert back to static image
npm run hero:revert

# Show help
node create-hero-video.js --help
```

## 🎬 Example Usage

```bash
# Generate cinematic transformation video (recommended)
npm run hero:video clean-yard-transformation cinematic 5

# Generate commercial-style happy dog video
npm run hero:video happy-dog-clean-yard commercial 3

# Generate lifestyle family video
npm run hero:video family-backyard-bliss lifestyle 5
```

## 🔧 Technical Details

### Generated Video Specs
- **Aspect Ratio**: 16:9 (perfect for hero sections)
- **Quality**: High (4K when possible)
- **FPS**: 24 (smooth playback)
- **Format**: MP4
- **Optimization**: Web-optimized for fast loading

### Hero Component Integration
The script automatically updates `src/components/hero.tsx` to replace:

```tsx
// FROM: Static image
<Image src="/modern_yard.png" ... />

// TO: Auto-playing video
<video
  src="/hero-video.mp4"
  autoPlay
  loop
  muted
  playsInline
  className="w-full h-[450px] md:h-[550px] object-cover"
  poster="/modern_yard.png" // Fallback
/>
```

### Benefits of Video Hero
- **Engagement**: 80% higher engagement than static images
- **Storytelling**: Shows transformation/results in action
- **Modern Feel**: Contemporary web design trend
- **Brand Differentiation**: Stand out from competitors
- **Conversion**: Higher conversion rates on landing pages

## 💰 Cost Estimation

- **Per video**: ~$0.10 (using Veo 3 Fast)
- **Recommended**: Generate 2-3 options and A/B test
- **Budget**: $0.30 for complete hero video setup

## 🎯 Best Practices

### For Hero Videos
1. **Keep it short**: 3-5 seconds optimal
2. **Focus on outcomes**: Show clean, happy results
3. **Use motion**: Subtle camera movement adds polish
4. **Brand consistency**: Minneapolis/Twin Cities aesthetic
5. **Mobile-first**: Ensure it works on all devices

### Content Strategy
- **Transformation focus**: Before/after impact
- **Emotional connection**: Happy pets and families
- **Professional quality**: Builds trust and credibility
- **Local relevance**: Minneapolis suburban settings
- **Eco-conscious**: Highlight sustainability aspects

## 🔄 A/B Testing

Generate multiple versions and test:

```bash
# Version A: Transformation focus
npm run hero:video clean-yard-transformation cinematic 5

# Version B: Happy pet focus  
npm run hero:video happy-dog-clean-yard commercial 3

# Version C: Family lifestyle
npm run hero:video family-backyard-bliss lifestyle 5
```

## 🚨 Troubleshooting

### Common Issues
1. **Token not found**: Check `.env` file has `REPLICATE_API_TOKEN`
2. **Generation timeout**: Try shorter duration or simpler prompt
3. **Video not loading**: Check file path and permissions
4. **Mobile playback**: Ensure `playsInline` attribute is set

### Fallback Strategy
- Video component includes `poster` attribute with static image
- If video fails to load, static image displays instead
- Progressive enhancement approach ensures reliability

## 📈 Performance Optimization

### Video Optimization
- Keep file size under 5MB for fast loading
- Use web-optimized MP4 format
- Consider WebM format for even smaller files
- Implement lazy loading for below-fold videos

### Loading Strategy
```tsx
<video
  src="/hero-video.mp4"
  autoPlay
  loop
  muted
  playsInline
  preload="metadata" // Faster initial load
  poster="/modern_yard.png" // Immediate visual
/>
```

## 🎨 Creative Direction

### Brand Alignment
- **YardDog**: Modern, tech-enabled, professional
- **by Yardura**: Established, trusted, eco-conscious
- **Twin Cities**: Local, community-focused, suburban
- **Target Audience**: Families with dogs, eco-conscious homeowners

### Visual Elements
- Clean, lush green grass
- Happy, healthy dogs
- Professional service providers
- Modern suburban homes
- Natural lighting
- Transformation moments

---

## 🎯 Ready to Create Your Hero Video?

1. **Choose your preset** from the list above
2. **Run the generation command**
3. **Download and integrate** the video
4. **Deploy and measure** engagement improvements

Transform your landing page from static to spectacular! 🌟
