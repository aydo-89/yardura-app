#!/bin/bash
set -e

REMOTE_USER="deploy"
REMOTE_HOST="146.190.240.179"
REMOTE_PATH="/var/www/insightscoop"
SSH_KEY="$HOME/.ssh/id_ed25519"

echo "🦀 Crustipene Deploy - clean-main branch"
echo "========================================"

# Stop PM2 services
echo "⏸️  Stopping services..."
ssh -i $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST} "pm2 stop all || true"

# Sync source files (excluding node_modules, .next will be synced separately)
echo "📦 Syncing source files..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '*.bak' \
  -e "ssh -i $SSH_KEY" \
  ./ \
  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/

# Sync .next build output
echo "📦 Syncing build output..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  .next/ \
  ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/.next/

# Install deps on server (in case package.json changed)
echo "📦 Installing dependencies on server..."
ssh -i $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && npm install --production 2>&1 | tail -10"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
ssh -i $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && npx prisma generate"

# Restart PM2
echo "🔄 Restarting services..."
ssh -i $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && pm2 start ecosystem.config.js"

echo "✅ Deploy complete!"
