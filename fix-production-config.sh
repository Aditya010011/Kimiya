#!/bin/bash

echo "🔧 Fixing production nginx configuration..."

# Create a clean production config that only handles ai-phone-call.kimiyi.ai
sudo sed '/dev-ai-phone-call\.kimiyi\.ai/,/^}/d' /etc/nginx/sites-available/kimiya-voice > /tmp/kimiya-voice-prod-clean

# Replace the original with the clean version
sudo cp /tmp/kimiya-voice-prod-clean /etc/nginx/sites-available/kimiya-voice

echo "✅ Removed dev domain from production config"

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    
    echo ""
    echo "🎉 Configuration fixed!"
    echo "🌐 Production: https://ai-phone-call.kimiyi.ai (production build)"
    echo "🔥 Development: https://dev-ai-phone-call.kimiyi.ai (hot reload)"
else
    echo "❌ Nginx configuration test failed"
    echo "🔙 Restoring backup..."
    sudo cp /etc/nginx/sites-available/kimiya-voice.backup.* /etc/nginx/sites-available/kimiya-voice
    exit 1
fi

# Clean up temp file
sudo rm -f /tmp/kimiya-voice-prod-clean
