#!/bin/bash

echo "🚀 Deploying production nginx configuration..."

# Check if production build exists
if [ ! -d "/var/www/kimiya-voice/dist" ]; then
    echo "❌ Production build not found at /var/www/kimiya-voice/dist"
    echo "💡 Please run 'npm run build' in the production directory first"
    exit 1
fi

echo "✅ Production build found at /var/www/kimiya-voice/dist"

# Check if production backend is running on port 3001
if ! netstat -tuln | grep -q ":3001 "; then
    echo "⚠️  Production backend not detected on port 3001"
    echo "💡 Make sure the production backend is running"
fi

# Copy production config to sites-available
echo "📋 Installing production nginx configuration..."
sudo cp nginx-production-only.conf /etc/nginx/sites-available/kimiya-voice-production

# Enable production config
echo "🔗 Enabling production configuration..."
sudo ln -sf /etc/nginx/sites-available/kimiya-voice-production /etc/nginx/sites-enabled/kimiya-voice-production

# Show current enabled sites
echo ""
echo "📁 Currently enabled nginx sites:"
ls -la /etc/nginx/sites-enabled/

# Test nginx configuration
echo ""
echo "🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    
    echo ""
    echo "🎉 Production configuration deployed!"
    echo ""
    echo "🌐 URLs:"
    echo "  Production:  https://ai-phone-call.kimiyi.ai (static build files)"
    echo "  Development: https://dev-ai-phone-call.kimiyi.ai (hot reload)"
    echo ""
    echo "📂 Serving from:"
    echo "  Production:  /var/www/kimiya-voice/dist -> backend:3001"
    echo "  Development: Vite dev server:3000 -> backend:3010"
    
else
    echo "❌ Nginx configuration test failed"
    echo "🔙 Removing production config to avoid issues"
    sudo rm -f /etc/nginx/sites-enabled/kimiya-voice-production
    exit 1
fi
