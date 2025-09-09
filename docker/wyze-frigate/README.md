## Wyze → Frigate stack (local AI NVR with bark alerts, clips, and timelapse)

This folder contains a ready-to-run Docker setup that:

- Exposes your Wyze camera(s) locally via Wyze Bridge (no flashing required)
- Runs Frigate NVR for object/audio detection, recordings, clips, and exports
- Includes MQTT (Mosquitto) for events and optional Home Assistant integration

Services:
- wyze-bridge: RTSP/HLS/WebRTC streams at `http://localhost:5000`
- mosquitto: MQTT broker at `mqtt://localhost:1883`
- frigate: Web UI at `http://localhost:5001`

### 1) Requirements
- Docker Desktop (macOS) or Docker Engine
- Your Wyze account login and API credentials (Key ID + API Key)

### 2) Create `.env`
Create a file named `.env` in this directory with:

```
WYZE_EMAIL=you@example.com
WYZE_PASSWORD=your_password

# Wyze API credentials (aka Key Id / Api Key)
WYZE_API_ID=your_key_id
WYZE_API_KEY=your_api_key

# Optional: LAN IP of your host to help WebRTC
HOST_IP=192.168.1.100

# Timezone for the Frigate container
TZ=America/Los_Angeles
```

Note: `.env` is already ignored by the repository’s `.gitignore`. Do not commit your real credentials.

### 3) Start the stack

From this folder:

```
docker compose up -d
```

Open Wyze Bridge UI at `http://localhost:5000` and verify your camera(s) are listed. Note the exact stream name (e.g., `Cam_v3_Yard`).

### 4) Point Frigate to your camera

Edit `frigate.yml` in this folder: replace `YOUR_CAM_NAME` with the stream name from Wyze Bridge:

```
rtsp://wyze-bridge:8554/YOUR_CAM_NAME
```

Then restart Frigate:

```
docker compose restart frigate
```

Open Frigate UI at `http://localhost:5001` → you should see live, clips, and recordings.

### 5) Bark alerts (audio)
This config enables Frigate’s audio detector and listens for `bark`. To forward alerts to your phone, integrate Frigate with Home Assistant (recommended) or use another MQTT consumer (Node-RED/Telegram/etc.).

Home Assistant quick start:
1. Install the Frigate integration (HACS → Frigate; then Add Integration → Frigate)
2. Ensure HA uses the same MQTT broker (host `mosquitto`, port `1883` inside Docker, or `localhost:1883` if external)
3. Automate on topic `frigate/events` and filter audio `labels` that include `bark` for camera `yard`

Example HA automation snippet (adjust `notify.mobile_app_*`):

```yaml
alias: "Yard: Dog Bark Alert"
trigger:
  - platform: mqtt
    topic: frigate/events
action:
  - variables:
      p: "{{ trigger.payload_json }}"
  - choose:
      - conditions:
          - "{{ p['type'] == 'audio' }}"
          - "{{ 'bark' in (p['audio']|default({})).get('labels', []) }}"
          - "{{ p['camera'] == 'yard' }}"
        sequence:
          - service: notify.mobile_app_your_phone
            data:
              title: "Bark detected in the yard"
              message: "Tap to watch"
              data:
                url: "https://YOUR_HA_URL/api/frigate/notifications/{{ p['id'] }}/clip.mp4"
```

### 6) Zones, sensitivity, and objects
Use the Frigate UI → Settings → Masks/Zones to draw your yard region. Paste the generated coordinates into `frigate.yml` under `cameras.yard.zones` to reduce false alerts.

### 7) Timelapse exports
`record.export.timelapse_args` is set to 60× at 25 fps. Use Frigate’s UI or HTTP API to export timelapses for a given time window.

### 8) Next: behaviors like digging / rolling / eating grass
Start with zones + object tracking (dog in yard) and bark audio. For advanced behavior classification:
- Add a small “behavior-engine” that subscribes to `frigate/events`, fetches 5–10s clips, and classifies behaviors (pose + rules, or a lightweight action model)
- Add a simple thumbs-up/down link in notifications to correct misclassifications and improve accuracy over a few days

If you share your exact Wyze model and the machine you’ll run this on, we can tailor detector settings and performance tips.

