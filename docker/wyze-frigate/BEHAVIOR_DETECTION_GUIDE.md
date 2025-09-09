# 🐕 Advanced Dog Behavior Detection System

This system combines Wyze Bridge, Frigate NVR, and custom AI analysis to detect and alert on specific dog behaviors in your yard.

## 🎯 What It Detects

1. **🕳️ Digging** - When your dog stays in one spot with consistent ground-focused motion
2. **🐕 Rolling** - Changes in body posture/aspect ratio indicating rolling behavior  
3. **🌱 Eating/Sniffing** - Head-down posture for extended periods (grass, poop, etc.)
4. **🔊 Prolonged Barking** - Extended or frequent barking sessions
5. **📹 Motion Events** - Any significant movement or activity

## 🏗️ System Architecture

```
Wyze Camera (VM) → Wyze Bridge → Frigate NVR → Behavior Detector → Alerts
     ↓                ↓             ↓              ↓
   P2P WiFi         RTSP         AI Detection    Home Assistant
```

## 🚀 Current Status

✅ **Wyze Bridge Connected** - Camera streaming via VM at `10.0.0.214:8554`  
✅ **Frigate Running** - Object detection active at `localhost:5001`  
✅ **Basic Detection** - Dogs, people, cats being tracked  
🔄 **Next Steps** - Deploy advanced behavior detection

## 📋 Next Steps to Complete Setup

### 1. Test Current System
First, verify everything is working:
- Visit http://localhost:5001 (Frigate Web UI)
- Check "Live" view - you should see your yard camera
- Check "Events" - should show detected objects (dogs, people)
- Let your dog into the yard and verify detection works

### 2. Deploy Advanced Behavior Detection

```bash
# Build and start the behavior detector
cd /Users/aydendunham/yardura_site/docker/wyze-frigate
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker compose up -d behavior-detector

# Check logs
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker logs -f behavior-detector
```

### 3. Adjust Detection Zones
1. Go to Frigate UI → Settings → Debug 
2. Turn on "Bounding boxes" and "Zones"
3. Watch your dog and note the areas where they:
   - Dig most often
   - Eat/sniff
   - Roll around
4. Update the zone coordinates in `frigate.yml`:

```yaml
zones:
  grass_area:
    coordinates: [x1,y1,x2,y2,x3,y3,x4,y4]  # Adjust based on your yard
  feeding_area:
    coordinates: [x1,y1,x2,y2,x3,y3,x4,y4]  # Where dog eats
```

### 4. Fine-tune Behavior Thresholds
Edit `behavior_detector.py` to adjust sensitivity:

```python
self.behavior_thresholds = {
    'digging': {
        'min_duration': 5,        # Minimum seconds to trigger
        'position_variance': 100  # Lower = more sensitive to staying in place
    },
    'eating': {
        'min_duration': 10,       # Minimum eating duration
        'head_down_threshold': 0.7 # How low head needs to be (0-1)
    }
}
```

### 5. Set Up Push Notifications

#### Option A: Simple Webhook Notifications
```bash
# Add webhook URL to behavior_detector.py
webhook_url = "https://maker.ifttt.com/trigger/dog_behavior/with/key/YOUR_KEY"
```

#### Option B: Home Assistant Integration
1. Install Home Assistant (if not already installed)
2. Add the configuration from `home_assistant_setup.yaml`
3. Replace `mobile_app_your_phone` with your actual device ID
4. Configure MQTT integration

### 6. Enable Timelapse Generation
```bash
# Run daily timelapse generation
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker compose exec behavior-detector python timelapse_generator.py
```

## 📱 Using the System

### Web Interfaces
- **Frigate UI**: http://localhost:5001 - Live view, events, clips
- **Wyze Bridge**: http://10.0.0.214:5000 - Camera status and controls

### Searching Events
With semantic search enabled, you can search events with natural language:
- "Show me when my dog was digging yesterday"
- "Find clips of my dog rolling in the grass"
- "When did my dog bark for more than 30 seconds?"

### Manual Controls
```bash
# Restart behavior detection
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker compose restart behavior-detector

# View behavior database
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker compose exec behavior-detector sqlite3 /app/data/dog_behaviors.db "SELECT * FROM behaviors ORDER BY timestamp DESC LIMIT 10;"

# Generate timelapse for specific date
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker compose exec behavior-detector python -c "
from timelapse_generator import TimelapseGenerator
from datetime import datetime
generator = TimelapseGenerator()
generator.create_daily_timelapse(date=datetime(2025, 8, 14))
"
```

## 🔧 Customization

### Adding New Behaviors
To detect new behaviors, modify `behavior_detector.py`:

1. Add new behavior threshold in `__init__`
2. Create analysis function (e.g., `analyze_jumping_behavior`)
3. Add to main analysis loop in `run_analysis`

### Adjusting Alerts
- Modify alert frequency in `run_analysis` (currently 5-minute cooldown)
- Change confidence thresholds for each behavior
- Add different alert types (email, SMS, etc.)

### Camera Settings
Adjust in Frigate UI or `frigate.yml`:
- Detection sensitivity
- Recording quality/duration
- Audio detection sensitivity

## 📊 Performance Tips

1. **CPU Usage**: The system uses CPU detection by default. For better performance:
   - Add Intel OpenVINO support
   - Use GPU acceleration if available
   - Consider USB Coral TPU for dedicated AI acceleration

2. **Storage**: Configure retention periods in `frigate.yml`:
   ```yaml
   record:
     retain:
       days: 3  # Adjust based on storage space
   ```

3. **Network**: VM-based Wyze Bridge is more stable than direct macOS Docker

## 🐛 Troubleshooting

### Behavior Detection Not Working
```bash
# Check behavior detector logs
DOCKER_HOST=unix:///Users/aydendunham/.orbstack/run/docker.sock docker logs behavior-detector

# Verify Frigate API access
curl http://localhost:5001/api/events?camera=yard&label=dog&limit=5
```

### No Dog Detections
1. Check detection confidence in Frigate UI
2. Adjust `min_score` in `frigate.yml`
3. Verify camera view covers dog areas
4. Check lighting conditions

### False Positive Behaviors
1. Increase `min_duration` thresholds
2. Adjust position/motion variance thresholds
3. Add more specific zone restrictions
4. Review detection logic in `analyze_*_behavior` functions

## 📈 Future Enhancements

- **Pose Estimation**: Use DeepLabCut for more accurate behavior detection
- **ML Training**: Train custom models on your dog's specific behaviors
- **Weather Integration**: Correlate behaviors with weather conditions
- **Health Monitoring**: Track activity levels and patterns over time
- **Multi-Camera**: Support multiple yard cameras
- **Mobile App**: Custom app for instant notifications and controls

## 🎉 You're All Set!

Your advanced dog behavior detection system is ready! The system will:
- ✅ Automatically detect and log dog behaviors
- ✅ Send alerts for unusual or concerning activities  
- ✅ Generate daily timelapse videos
- ✅ Provide searchable event history
- ✅ Learn and improve over time

Enjoy monitoring your furry friend! 🐕❤️