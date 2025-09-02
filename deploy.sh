#!/bin/bash

# Kimiya Voice Deployment Script
# This script builds and deploys the app on the VM

set -e

echo "🚀 Starting deployment..."

# Build frontend
echo "📦 Building frontend..."
npm run build

# Restart backend with PM2
echo "🔄 Restarting backend..."
pm2 restart kimiya-voice-backend

# Reload nginx
echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

# Check status
echo "✅ Checking services..."
pm2 status
sudo systemctl status nginx --no-pager -l

echo "🎉 Deployment complete!"
echo "🌐 Your app is available at:"
echo "   • https://ai-phone-call.kimiyi.ai (HTTPS - Custom Domain)"
echo "   • http://20.255.99.49 (HTTP - IP Access)"
echo "   • http://20.255.99.49:8080 (alternative port)"
echo "🔍 Health check: https://ai-phone-call.kimiyi.ai/health"
echo "📊 Backend API: https://ai-phone-call.kimiyi.ai/api/"
echo ""
echo "🔒 HTTPS URLs:"
echo "   • https://ai-phone-call.kimiyi.ai (Main - Custom SSL)"
echo "   • https://ai-phone-call.kimiyi.ai/health (Health check)"
echo "   • https://ai-phone-call.kimiyi.ai/api/ (API endpoints)"
echo ""
echo "🔒 To enable HTTPS:"
echo "   1. Get a domain name (e.g., from No-IP: https://www.noip.com)"
echo "   2. Point the domain to: 20.255.99.49"
echo "   3. Run: ./setup-https.sh your-domain.com"
echo ""
echo "⚠️  If the app is not accessible externally, configure Azure Network Security Group:"
echo "   1. Go to Azure Portal → VM → Networking"
echo "   2. Add inbound rule: Allow TCP ports 80, 443, and 8080 from Any source"