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
REMOTE_DEPLOY_DIR='/root'
WEB_DIR='/var/www/yardura.com'

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

# Copy configuration files
cp package.json dist/
cp package-lock.json dist/
cp next.config.js dist/
cp replicate-proxy.js dist/
cp .env dist/
cp tsconfig.json dist/
cp tailwind.config.ts dist/
cp postcss.config.mjs dist/

# Create tar.gz
echo -e "${YELLOW}📦 Creating tar.gz archive...${NC}"
tar -czf yardura-production.tar.gz dist/ package.json package-lock.json replicate-proxy.js .env

# Upload to server
echo -e "${YELLOW}📤 Uploading to server...${NC}"
scp -i "$KEY_PATH" yardura-production.tar.gz "$SERVER:$REMOTE_DEPLOY_DIR/"

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

  echo '📂 Deploying files...'
  # Stop services first
  pm2 stop yardura 2>/dev/null || true
  pm2 stop yardura-proxy 2>/dev/null || true

  # Remove old files
  sudo rm -rf $WEB_DIR/*

  # Copy new files
  sudo cp -r $REMOTE_DEPLOY_DIR/dist/* $WEB_DIR/
  sudo cp -r $REMOTE_DEPLOY_DIR/dist/.next $WEB_DIR/ 2>/dev/null || true

  echo '🔐 Setting permissions...'
  sudo chown -R www-data:www-data $WEB_DIR

  echo '📥 Installing dependencies...'
  cd $WEB_DIR
  npm install --production --no-optional

  echo '🔧 Generating Prisma client...'
  npx prisma generate

  echo '🛑 Starting services...'
  pm2 start npm --name 'yardura' -- start 2>/dev/null || pm2 restart yardura 2>/dev/null || true
  pm2 restart yardura-proxy 2>/dev/null || true

  echo '🔄 Reloading nginx...'
  sudo systemctl reload nginx 2>/dev/null || true

  echo '✅ Deployment complete!'
  pm2 list
"

echo -e "${GREEN}✅ Deployment successful!${NC}"

# Cleanup
rm -f yardura-production.tar.gz
rm -rf dist

echo -e "${GREEN}🧹 Cleanup complete!${NC}"
