#!/bin/bash

# Quick fix for nginx development configuration

echo "Setting up nginx for development hot reload..."

# Copy configuration to sites-available
sudo cp nginx-dev.conf /etc/nginx/sites-available/kimiya-voice-dev

# Enable the site
sudo ln -sf /etc/nginx/sites-available/kimiya-voice-dev /etc/nginx/sites-enabled/kimiya-voice-dev

# Test nginx configuration
echo "Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    
    echo ""
    echo "🎉 Hot reload setup complete!"
    echo "🌐 Access your app at: https://dev-ai-phone-call.kimiyi.ai"
    echo "🔥 Hot reload should now work on the dev domain"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi
