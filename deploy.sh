#!/bin/bash

# InsightScoop Production Deployment Script
set -e

echo '🚀 Starting InsightScoop Production Deployment...'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER='deploy@146.190.240.179'
KEY_PATH="$HOME/.ssh/id_ed25519"
REMOTE_DEPLOY_DIR='/var/tmp/insightscoop-deploy'
WEB_DIR='/var/www/insightscoop'

# Build locally
echo -e "${YELLOW}📦 Building application locally...${NC}"
npm run build

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
rm -rf dist
mkdir -p dist

# Copy build artifacts
cp -r .next dist/
cp -r public dist/
cp -r prisma dist/
cp -r src dist/
[ -d data ] && cp -r data dist/ || true
[ -d config ] && cp -r config dist/ || true
[ -d voice-agent ] && cp -r voice-agent dist/ || true
[ -d jobs ] && cp -r jobs dist/ || true
[ -d infra ] && cp -r infra dist/ || true

# Copy configuration files (do NOT bundle local .env to avoid overwriting server prod env)
cp package.json dist/
cp package-lock.json dist/
cp next.config.mjs dist/
cp tsconfig.json dist/
cp tailwind.config.ts dist/
cp postcss.config.mjs dist/
[ -f replicate-proxy.js ] && cp replicate-proxy.js dist/ || true

# Create tar.gz (without local .env files and macOS metadata files)
echo -e "${YELLOW}📦 Creating tar.gz archive...${NC}"
tar -czf insightscoop-production.tar.gz --exclude='._*' --exclude='.DS_Store' --exclude='node_modules' -C dist .

# Prepare remote staging directory
echo -e "${YELLOW}📤 Preparing remote staging dir...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "mkdir -p $REMOTE_DEPLOY_DIR && rm -f $REMOTE_DEPLOY_DIR/*.tar.gz"

# Upload to server
echo -e "${YELLOW}📤 Uploading deployment package...${NC}"
scp -i "$KEY_PATH" insightscoop-production.tar.gz "$SERVER:$REMOTE_DEPLOY_DIR/"

# Create ecosystem config for PM2 with crash loop protection
echo -e "${YELLOW}📝 Creating PM2 ecosystem config...${NC}"
cat > /tmp/ecosystem.config.js << 'ECOSYSTEM_EOF'
module.exports = {
  apps: [
    {
      name: 'insightscoop',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
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
      }
    },
    {
      name: 'worker-billing',
      script: 'npx',
      args: 'tsx jobs/start-billing-automation.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-customer-email-reports',
      script: 'npx',
      args: 'tsx jobs/start-customer-email-reports.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-media-analysis',
      script: 'npx',
      args: 'tsx jobs/start-media-analysis-worker.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-offers',
      script: 'npx',
      args: 'tsx jobs/start-marketplace-offers.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-offer-sweeper',
      script: 'npx',
      args: 'tsx jobs/start-marketplace-offer-sweeper.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-offer-auto-assign',
      script: 'npx',
      args: 'tsx jobs/start-marketplace-offer-auto-assign.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-push-notifications',
      script: 'npx',
      args: 'tsx jobs/start-push-notifications.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-visit-generator',
      script: 'npx',
      args: 'tsx jobs/start-visit-generator-worker.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-visit-summary',
      script: 'npx',
      args: 'tsx jobs/start-visit-summary-worker.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-wellness-embeddings',
      script: 'npx',
      args: 'tsx jobs/start-wellness-embeddings.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-payout-release',
      script: 'npx',
      args: 'tsx jobs/start-payout-release.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-route-drafts',
      script: 'npx',
      args: 'tsx jobs/start-route-drafts-worker.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    },
    {
      name: 'worker-outbound-transcription',
      script: 'npx',
      args: 'tsx jobs/start-outbound-transcription-worker.ts',
      cwd: '/var/www/insightscoop',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 10000
    }
  ]
};
ECOSYSTEM_EOF

scp -i "$KEY_PATH" /tmp/ecosystem.config.js "$SERVER:$WEB_DIR/ecosystem.config.js"

# Deploy on server
echo -e "${YELLOW}🚀 Deploying on server...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "
  set -e
  cd $WEB_DIR
  
  echo '📦 Extracting files...'
  cd $REMOTE_DEPLOY_DIR
  rm -rf extracted
  mkdir -p extracted
  tar -xzf insightscoop-production.tar.gz -C extracted
  
  echo '📋 Creating backup...'
  BACKUP_NAME=\"insightscoop.backup.\$(date +%Y%m%d_%H%M%S)\"
  cp -r $WEB_DIR/.next /var/tmp/\$BACKUP_NAME-next 2>/dev/null || true
  
  echo '🧹 Cleaning up old backups (keeping last 2)...'
  cd /var/tmp && ls -dt insightscoop.backup.*-next 2>/dev/null | tail -n +3 | xargs rm -rf 2>/dev/null || true
  
  echo '🛑 Stopping services gracefully...'
  # Stop workers first, then main app
  pm2 stop all --silent 2>/dev/null || true
  sleep 2
  
  echo '📂 Deploying files...'
  # Use rsync to overwrite files (works even if owned by different user)
  # Remove .next build files but PRESERVE the image cache
  rm -rf $WEB_DIR/.next/server 2>/dev/null || true
  rm -rf $WEB_DIR/.next/static 2>/dev/null || true
  rm -f $WEB_DIR/.next/*.json 2>/dev/null || true
  rm -f $WEB_DIR/.next/*.js 2>/dev/null || true
  # Keep .next/cache/images to prevent image 404s after deploy
  
  # Rsync new files (overwrites existing, doesn't need delete permission)
  rsync -a --no-perms --no-owner --no-group $REMOTE_DEPLOY_DIR/extracted/ $WEB_DIR/
  
  echo '🔐 Setting file permissions...'
  # Ensure public folder is readable by nginx
  chmod -R 755 $WEB_DIR/public 2>/dev/null || true
  find $WEB_DIR/public -type f -exec chmod 644 {} \\; 2>/dev/null || true
  
  echo '📥 Installing dependencies...'
  cd $WEB_DIR
  npm install --omit=dev
  
  echo '🔧 Generating Prisma client...'
  npx prisma generate
  
  echo '🗃️ Running Prisma migrations...'
  npx prisma migrate deploy
  
  echo '🔄 Starting services with safe restart...'
  # Delete all existing processes to ensure clean state
  pm2 delete all 2>/dev/null || true
  
  # Start with ecosystem config (has crash loop protection)
  pm2 start ecosystem.config.js
  
  # Save PM2 config
  pm2 save
  
  echo '🔄 Reloading nginx to clear any cached responses...'
  sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true
  
  echo '🧹 Clearing Next.js image optimization cache (stale entries only)...'
  # Only clear cache entries older than 7 days to prevent image 404s
  find $WEB_DIR/.next/cache/images -type f -mtime +7 -delete 2>/dev/null || true
  
  echo '🧹 Cleaning up deployment staging files...'
  rm -rf $REMOTE_DEPLOY_DIR/extracted 2>/dev/null || true
  rm -f $REMOTE_DEPLOY_DIR/*.tar.gz 2>/dev/null || true
  
  echo '✅ Deployment complete!'
  echo ''
  pm2 list
"

# Verify images are accessible
echo -e "${YELLOW}🖼️ Verifying images are accessible...${NC}"
ssh -i "$KEY_PATH" "$SERVER" "
  # Ensure public folder has correct ownership
  sudo chown -R deploy:deploy $WEB_DIR/public 2>/dev/null || true
  
  # Quick sanity check
  if [ -f $WEB_DIR/public/hero_backgrounds/arlo_coral_left_light.jpeg ]; then
    echo '✅ Hero backgrounds exist'
  else
    echo '⚠️ Warning: Hero backgrounds may be missing'
  fi
  
  if [ -d $WEB_DIR/public/stool-library ]; then
    echo '✅ Stool library exists'
  else
    echo '⚠️ Warning: Stool library may be missing'
  fi
"

# Cleanup local files
echo -e "${YELLOW}🧹 Cleaning up local files...${NC}"
rm -f insightscoop-production.tar.gz
rm -rf dist
rm -f /tmp/ecosystem.config.js

echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${GREEN}📋 Useful commands:${NC}"
echo "  Monitor logs:     ssh deploy@146.190.240.179 'pm2 logs'"
echo "  Check status:     ssh deploy@146.190.240.179 'pm2 list'"
echo "  Restart app:      ssh deploy@146.190.240.179 'pm2 restart insightscoop'"
echo "  Restart workers:  ssh deploy@146.190.240.179 'pm2 restart all'"
