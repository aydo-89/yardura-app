#!/bin/bash

echo "🚀 Starting Yardura Production Deployment..."

# Navigate to web directory
cd /var/www/yardura.com

# Create backup of current site
echo "📦 Creating backup of current site..."
sudo cp -r . ../yardura.com.backup.$(date +%Y%m%d_%H%M%S)

# Extract new files
echo "📂 Extracting new production files..."
cd /root
tar -xzf yardura-production.tar.gz

# Copy built files to web directory
echo "📋 Deploying built files..."
sudo cp -r dist/* /var/www/yardura.com/
sudo cp replicate-proxy.js /var/www/yardura.com/
sudo cp package.json /var/www/yardura.com/
sudo cp package-lock.json /var/www/yardura.com/
sudo cp .env /var/www/yardura.com/

# Set correct permissions
echo "🔐 Setting permissions..."
sudo chown -R www-data:www-data /var/www/yardura.com
sudo chmod -R 755 /var/www/yardura.com

# Install Node.js dependencies
echo "📥 Installing Node.js dependencies..."
cd /var/www/yardura.com
npm install

# Stop existing proxy server if running
echo "🛑 Stopping existing proxy server..."
pm2 stop yardura-proxy 2>/dev/null || true
pm2 delete yardura-proxy 2>/dev/null || true

# Start proxy server with PM2
echo "🚀 Starting proxy server..."
pm2 start replicate-proxy.js --name yardura-proxy
pm2 save

# Restart nginx
echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

# Show status
echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 list
echo "🌐 Site should be live at your domain"
echo "🔗 Proxy server running on port 3001" 