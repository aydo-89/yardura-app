# Yardura Deployment Guide

This document outlines multiple deployment strategies for the Yardura application.

## 🚀 Quick Deployment (Current)

Use the automated deployment script for the fastest deployment:

```bash
# From project root
./deploy.sh
```

This will:

- Build the application locally
- Create a deployment package
- Upload to production server
- Deploy and restart services
- Clean up temporary files

## 🔄 Automated Deployment Options

### Option 1: GitHub Actions (Recommended for CI/CD)

1. **Setup GitHub Secrets:**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add `SERVER_SSH_KEY` with your private SSH key

2. **Push to main branch:**

   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

3. **Or trigger manually:**
   - Go to GitHub Actions tab
   - Click "Deploy to Production"
   - Click "Run workflow"

### Option 2: Docker Deployment

1. **Build and deploy:**

   ```bash
   # Build the production image
   docker build -f Dockerfile.prod -t yardura:latest .

   # Deploy with docker-compose
   docker-compose -f docker-compose.prod.yml up -d

   # Or deploy to remote server
   docker save yardura:latest | ssh root@159.223.197.13 docker load
   ssh root@159.223.197.13 docker-compose -f docker-compose.prod.yml up -d
   ```

### Option 3: Manual Deployment

If you need to deploy manually:

```bash
# 1. Build locally
npm run build

# 2. Create package
mkdir -p dist
cp -r .next dist/
cp -r public dist/
cp package.json package-lock.json next.config.js replicate-proxy.js .env dist/

# 3. Upload to server
scp -i ~/.ssh/id_ed25519 yardura-production.tar.gz root@159.223.197.13:/root/

# 4. Deploy on server
ssh -i ~/.ssh/id_ed25519 root@159.223.197.13 << 'EOF'
cd /var/www/yardura.com
sudo cp -r . ../yardura.com.backup.$(date +%Y%m%d_%H%M%S)
sudo rm -rf .next
sudo cp -r /root/dist/* .
sudo chown -R www-data:www-data .
npm install --production
pm2 restart yardura yardura-proxy
sudo systemctl reload nginx
EOF
```

## 📋 Pre-deployment Checklist

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Database migrations applied
- [ ] Environment variables updated
- [ ] Backup created (automatic in scripts)

## 🔍 Troubleshooting

### Common Issues:

1. **Build fails:**

   ```bash
   rm -rf node_modules .next
   npm install
   npm run build
   ```

2. **Services won't start:**

   ```bash
   ssh root@159.223.197.13
   pm2 logs yardura --lines 50
   pm2 restart yardura
   ```

3. **Permission issues:**

   ```bash
   ssh root@159.223.197.13
   sudo chown -R www-data:www-data /var/www/yardura.com
   ```

4. **Database connection issues:**
   - Check `.env` file on server
   - Verify database is accessible
   - Run `npx prisma generate` if schema changed

## 🔐 Security Notes

- SSH keys are stored securely
- Environment variables contain sensitive data
- Regular backups are created automatically
- Services run as non-root users where possible

## 📊 Monitoring

After deployment:

- Check PM2 status: `pm2 list`
- View logs: `pm2 logs yardura`
- Monitor nginx: `sudo systemctl status nginx`
- Check application health: Visit `/api/health`

## 🚀 Future Improvements

1. **Blue-green deployments** for zero-downtime
2. **Database migrations** in deployment pipeline
3. **Automated testing** before deployment
4. **Rollback scripts** for quick recovery
5. **Infrastructure as Code** with Terraform
