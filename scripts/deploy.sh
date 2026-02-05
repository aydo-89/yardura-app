#!/bin/bash
# Deploy InsightScoop - builds locally and syncs to server
# Usage: ./scripts/deploy.sh

set -e

REPO_DIR="/Users/shimpsbugs/.openclaw/yardura-app"
SERVER="deploy@146.190.240.179"
REMOTE_DIR="/var/www/insightscoop"

cd "$REPO_DIR"

echo "📦 Installing dependencies..."
npm ci --silent

echo "🔨 Building Next.js..."
npx next build --no-lint

echo "📤 Syncing to server..."
# Sync .next folder
rsync -avz --delete .next/ "$SERVER:$REMOTE_DIR/.next/"

# Sync public folder (in case of new assets)
rsync -avz public/ "$SERVER:$REMOTE_DIR/public/"

# Sync package files
rsync -avz package.json package-lock.json "$SERVER:$REMOTE_DIR/"

echo "🔄 Restarting PM2..."
ssh "$SERVER" "cd $REMOTE_DIR && pm2 restart insightscoop"

echo "✅ Deploy complete!"
echo "🌐 https://getinsightscoop.com"
