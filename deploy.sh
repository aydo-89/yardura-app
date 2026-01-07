#!/bin/bash

# Yardura Production Deployment Script
set -e

echo '🚀 Starting Yardura Production Deployment...'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER='root@159.223.197.13'
KEY_PATH='/Users/aydendunham/.ssh/id_ed25519'
REMOTE_DEPLOY_DIR='/var/tmp/yardura'
WEB_DIR='/var/www/yardura.com'

# Build locally (skip type-check for faster deploys)
echo -e "${YELLOW}📦 Building application locally...${NC}"
npm run build:deploy

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
rm -rf dist
mkdir -p dist

# Copy build artifacts
cp -r .next dist/
cp -r public dist/
cp -r prisma dist/
cp -r src dist/
cp -r data dist/
cp -r config dist/
cp -r voice-agent dist/

# Copy configuration files (do NOT bundle local .env to avoid overwriting server prod env)
cp package.json dist/
cp package-lock.json dist/
cp next.config.mjs dist/
cp replicate-proxy.js dist/
cp tsconfig.json dist/
cp tailwind.config.ts dist/
cp postcss.config.mjs dist/

# Create tar.gz (without local .env files and macOS metadata files)
echo -e "${YELLOW}📦 Creating tar.gz archive...${NC}"
tar -czf yardura-production.tar.gz --exclude='._*' --exclude='.DS_Store' dist/ package.json package-lock.json replicate-proxy.js

# Upload to server
echo -e "${YELLOW}📤 Preparing remote staging dir and uploading...${NC}"
# Ensure remote staging directory exists and is writable
ssh -i "$KEY_PATH" "$SERVER" "sudo mkdir -p $REMOTE_DEPLOY_DIR && sudo chmod 777 $REMOTE_DEPLOY_DIR || true"
# Optional: quick disk space check
ssh -i "$KEY_PATH" "$SERVER" "df -h / /tmp /var/tmp 2>/dev/null || true"
# Prune stale artifacts and old backups before upload
ssh -i "$KEY_PATH" "$SERVER" "\
  echo '🧹 Pruning old staging tarballs and backups...'; \
  rm -f $REMOTE_DEPLOY_DIR/*.tar.gz 2>/dev/null || true; \
  # Remove backups older than 7 days
  find /var/www -maxdepth 1 -type d -name 'yardura.com.backup.*' -mtime +7 -exec rm -rf {} + 2>/dev/null || true; \
  # Keep only latest 3 backups (defensive)
  ls -1dt /var/www/yardura.com.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -rf \
"
# Upload with an explicit destination filename to avoid directory write quirks
scp -i "$KEY_PATH" yardura-production.tar.gz "$SERVER:$REMOTE_DEPLOY_DIR/yardura-production.tar.gz"

# Deploy on server
echo -e "${YELLOW}🚀 Deploying on server...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "
  set -e
  echo '📦 Extracting files...'
  cd $REMOTE_DEPLOY_DIR
  rm -rf dist
  tar -xzf yardura-production.tar.gz

  echo '📋 Creating backup...'
  sudo cp -r $WEB_DIR \"${WEB_DIR}.backup.\$(date +%Y%m%d_%H%M%S)\" 2>/dev/null || true

  echo '🧹 Pruning old backups (post-backup)...'
  # Remove backups older than 7 days
  sudo find /var/www -maxdepth 1 -type d -name 'yardura.com.backup.*' -mtime +7 -exec rm -rf {} + 2>/dev/null || true
  # Keep only latest 3 backups
  ls -1dt /var/www/yardura.com.backup.* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf

  echo '📂 Deploying files...'
  # Stop services first
  pm2 stop yardura 2>/dev/null || true
  pm2 stop yardura-proxy 2>/dev/null || true

  # Backup image directories before deployment
  echo '📸 Backing up image directories...'
  sudo mkdir -p $REMOTE_DEPLOY_DIR/image_backup
  sudo cp -r $WEB_DIR/public/dog_images $REMOTE_DEPLOY_DIR/image_backup/ 2>/dev/null || true
  sudo cp -r $WEB_DIR/public/dog_images2 $REMOTE_DEPLOY_DIR/image_backup/ 2>/dev/null || true
  sudo cp -r $WEB_DIR/public/brand $REMOTE_DEPLOY_DIR/image_backup/ 2>/dev/null || true
  sudo cp -r $WEB_DIR/public/sections $REMOTE_DEPLOY_DIR/image_backup/ 2>/dev/null || true

  # Remove old build files (preserve node_modules and .env files)
  sudo rm -rf $WEB_DIR/.next
  sudo rm -rf $WEB_DIR/public
  sudo rm -rf $WEB_DIR/prisma
  sudo rm -rf $WEB_DIR/src
  sudo rm -rf $WEB_DIR/config
  sudo rm -f $WEB_DIR/*.js $WEB_DIR/*.mjs $WEB_DIR/*.json $WEB_DIR/*.ts

  # Copy new files
  sudo cp -r $REMOTE_DEPLOY_DIR/dist/* $WEB_DIR/
  sudo cp -r $REMOTE_DEPLOY_DIR/dist/.next $WEB_DIR/ 2>/dev/null || true

  # Restore image directories after deployment
  echo '📸 Restoring image directories...'
  sudo cp -r $REMOTE_DEPLOY_DIR/image_backup/dog_images $WEB_DIR/public/ 2>/dev/null || true
  sudo cp -r $REMOTE_DEPLOY_DIR/image_backup/dog_images2 $WEB_DIR/public/ 2>/dev/null || true
  sudo cp -r $REMOTE_DEPLOY_DIR/image_backup/brand $WEB_DIR/public/ 2>/dev/null || true
  sudo cp -r $REMOTE_DEPLOY_DIR/image_backup/sections $WEB_DIR/public/ 2>/dev/null || true
  sudo rm -rf $REMOTE_DEPLOY_DIR/image_backup

  echo '🔐 Setting permissions...'
  sudo chown -R www-data:www-data $WEB_DIR

  echo '🧹 Removing macOS metadata files...'
  sudo find $WEB_DIR/public -name '._*' -type f -delete 2>/dev/null || true
  sudo find $WEB_DIR/public -name '.DS_Store' -type f -delete 2>/dev/null || true

  echo '📥 Installing dependencies...'
  cd $WEB_DIR
  npm install

  echo '🔧 Generating Prisma client...'
  npx prisma generate

  echo '🛑 Starting services...'
  pm2 delete yardura 2>/dev/null || true
  pm2 start npm --name yardura -- start
  pm2 restart yardura-proxy 2>/dev/null || true

  echo '🔄 Reloading nginx...'
  sudo systemctl reload nginx 2>/dev/null || true

  echo '✅ Deployment complete!'
  pm2 list
"

# Sync all public image directories to ensure they're always up-to-date
echo -e "${YELLOW}📸 Syncing image directories to server...${NC}"

# Sync seasonal background images in root public/
echo "Syncing seasonal backgrounds..."
rsync -avz -e "ssh -i $KEY_PATH" \
  --exclude='._*' \
  --exclude='.DS_Store' \
  public/grass-field.jpg \
  public/leaves_background.jpg \
  public/snow_background.jpg \
  "$SERVER:$WEB_DIR/public/"

# Sync image directories
rsync -avz --delete -e "ssh -i $KEY_PATH" \
  --exclude='._*' \
  --exclude='.DS_Store' \
  public/dog_images/ "$SERVER:$WEB_DIR/public/dog_images/"

rsync -avz --delete -e "ssh -i $KEY_PATH" \
  --exclude='._*' \
  --exclude='.DS_Store' \
  public/dog_images2/ "$SERVER:$WEB_DIR/public/dog_images2/"

rsync -avz --delete -e "ssh -i $KEY_PATH" \
  --exclude='._*' \
  --exclude='.DS_Store' \
  public/brand/ "$SERVER:$WEB_DIR/public/brand/"

rsync -avz --delete -e "ssh -i $KEY_PATH" \
  --exclude='._*' \
  --exclude='.DS_Store' \
  public/sections/ "$SERVER:$WEB_DIR/public/sections/"

# Fix permissions after rsync
ssh -i "$KEY_PATH" "$SERVER" "sudo chown -R www-data:www-data $WEB_DIR/public"

echo -e "${GREEN}✅ Image sync complete!${NC}"

# Ensure ecosystem.config.js has all environment variables for BOTH apps
# CRITICAL: Include restart limits to prevent infinite crash loops that freeze the server!
echo -e "${YELLOW}📝 Updating PM2 ecosystem config...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "cd $WEB_DIR && cat > ecosystem.config.js.full << 'EOFCONFIG'
module.exports = {
  apps: [
    {
      name: 'yardura',
      script: 'npm',
      args: 'start',
      cwd: '$WEB_DIR',
      instances: 1,
      autorestart: true,
      // CRITICAL: Prevent infinite restart loops
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
        // Other env vars loaded from .env.production on server
      }
    },
    {
      name: 'yardura-voice-agent',
      script: 'npx',
      args: 'tsx voice-agent/server.ts',
      cwd: '$WEB_DIR',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 4001
        // Other env vars loaded from .env.production on server
      }
    }
  ]
}
EOFCONFIG
"

# Ensure nginx proxies WebSocket traffic to the voice agent server
echo -e "${YELLOW}📝 Checking nginx configuration...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "
if ! grep -q 'location /voice/stream' /etc/nginx/sites-available/yardura.com 2>/dev/null; then
  echo 'Adding /voice/stream proxy to nginx...'
  sudo sed -i '/location \\/ {/i\\
    # Voice agent WebSocket proxy\\
    location /voice/stream {\\
        proxy_pass http://127.0.0.1:4001/stream;\\
        proxy_http_version 1.1;\\
        proxy_set_header Upgrade \$http_upgrade;\\
        proxy_set_header Connection \"upgrade\";\\
        proxy_set_header Host \$host;\\
        proxy_set_header X-Real-IP \$remote_addr;\\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\\
        proxy_set_header X-Forwarded-Proto \$scheme;\\
        proxy_set_header X-Twilio-Signature \$http_x_twilio_signature;\\
        proxy_read_timeout 300s;\\
        proxy_send_timeout 300s;\\
        proxy_connect_timeout 75s;\\
        proxy_buffering off;\\
    }\\
' /etc/nginx/sites-available/yardura.com
  sudo nginx -t && sudo systemctl reload nginx
  echo 'Nginx updated.'
else
  echo 'Nginx WebSocket proxy already present.'
fi
"

# Clear Next.js image cache and restart BOTH apps
echo -e "${YELLOW}🧹 Clearing Next.js image cache and restarting services...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "sudo rm -rf $WEB_DIR/.next/cache/images && cd $WEB_DIR && sudo pm2 delete yardura yardura-voice-agent 2>/dev/null || true && sudo pm2 start ecosystem.config.js.full && sudo pm2 save"

echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${GREEN}📋 Next steps:${NC}"
echo "1. Update Twilio webhooks:"
echo "   Inbound:  https://www.getinsightscoop.com/api/twilio/voice/inbound"
echo "   Status:   https://www.getinsightscoop.com/api/twilio/voice/status"
echo ""
echo "2. Test the webhook:"
echo "   curl -X POST https://www.getinsightscoop.com/api/twilio/voice/inbound -d 'CallSid=TEST&From=+16125819812&To=+18774179273'"
echo ""
echo "3. Call 1-877-417-YARD to test!"
echo ""
echo "4. Monitor logs:"
echo "   ssh -i ~/.ssh/id_ed25519 root@159.223.197.13"
echo "   sudo pm2 logs yardura-voice-agent"

# Cleanup
rm -f yardura-production.tar.gz
rm -rf dist

echo -e "${GREEN}🧹 Cleanup complete!${NC}"
