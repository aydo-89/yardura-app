# 🏆 Professional Depth Mapping with Replicate API

This guide shows you how to enable **professional AI-powered depth mapping** using Replicate's MiDaS model for truly realistic 3D effects.

## 🚀 Quick Setup (2 minutes)

### 1. **Install Dependencies**
```bash
npm install express cors dotenv
```

### 2. **Start the Proxy Server**
```bash
node replicate-proxy.js
```

You should see:
```
🚀 Replicate Proxy Server running on http://localhost:3001
📡 Frontend should call: http://localhost:3001/api/depth
🔑 API Key Status: ✅ Found
```

### 3. **Upload a Photo**
- Open your app: `http://localhost:5173/`
- Click on WasteWell product
- Upload an outdoor photo (patio, backyard, garden)
- **Watch for**: "✅ Professional depth map generated via proxy!"

---

## 🔧 Troubleshooting

### ❌ "API Key Status: ❌ Missing"
Make sure your `.env` file contains:
```bash
VITE_REPLICATE_API_TOKEN=r8_your_token_here
```

### ❌ "Local proxy server not available"
The app will automatically fall back to enhanced local processing. To use professional AI:
1. Ensure `node replicate-proxy.js` is running
2. Check that port 3001 is not blocked

### ❌ CORS errors in browser console
This is expected when the proxy isn't running. The app automatically falls back to local processing.

---

## 🌟 What You Get

### **With Proxy (Professional)**
- 🏆 State-of-the-art MiDaS v3.1 depth estimation
- 💰 ~$0.0002 per image (5000 images per $1)
- ✨ Perfect depth maps for any scene type
- 🎯 Works with indoor and outdoor images

### **Without Proxy (Enhanced Local)**
- ⚡ Fast local processing
- 🆓 Completely free
- 🎨 Dramatic 3D visual effects
- 📱 Works offline

---

## 🎮 Interactive Controls

Both modes include full 3D model placement controls:

- **🖱️ Drag & Drop**: Click and drag the 3D model around the scene
- **📍 Position Sliders**: Fine-tune X/Y placement
- **🔍 Depth Control**: Push the model deeper into the scene
- **📏 Scale**: Resize to match perspective
- **🔄 Rotation**: Rotate to match scene angle

---

## 💡 Production Deployment

For production, deploy the proxy server to:
- Vercel Functions
- Netlify Functions  
- AWS Lambda
- Any Node.js hosting

Update the frontend to call your production proxy URL instead of `localhost:3001`.

---

## 🎯 Cost Analysis

**Replicate MiDaS Pricing:**
- **$0.0002 per image** 
- **5000 images per $1**
- **No monthly fees**

**Example costs:**
- 100 photos: $0.02 (2 cents)
- 1000 photos: $0.20 (20 cents) 
- 10,000 photos: $2.00

*Extremely affordable for professional-quality depth mapping!* 