#!/bin/bash

echo "🔧 Restoring production nginx configuration..."

# Check if production config exists
if [ ! -f "/etc/nginx/sites-available/kimiya-voice" ]; then
    echo "❌ Production config not found at /etc/nginx/sites-available/kimiya-voice"
    exit 1
fi

# Check what domains the production config handles
echo "📋 Checking production config domains..."
sudo grep "server_name" /etc/nginx/sites-available/kimiya-voice

echo ""
echo "🔗 Re-enabling production configuration..."

# Re-enable production config
sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/kimiya-voice

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Show current enabled sites
    echo ""
    echo "📁 Currently enabled sites:"
    ls -la /etc/nginx/sites-enabled/
    
    # Reload nginx
    echo ""
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    
    echo ""
    echo "🎉 Production configuration restored!"
    echo "🌐 Production: https://ai-phone-call.kimiyi.ai"
    echo "🔥 Development: https://dev-ai-phone-call.kimiyi.ai (with hot reload)"
else
    echo "❌ Nginx configuration test failed"
    echo "🔙 Removing production config to avoid conflicts"
    sudo rm -f /etc/nginx/sites-enabled/kimiya-voice
    exit 1
fi
