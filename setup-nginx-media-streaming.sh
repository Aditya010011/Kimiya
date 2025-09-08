#!/bin/bash

# Setup script for nginx with media streaming capabilities
# This script installs and configures nginx with modules for optimal media streaming

set -e

echo "🎬 Setting up Nginx for Media Streaming..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  This script should not be run as root for security reasons"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install nginx with additional modules
echo "🌐 Installing nginx with media streaming modules..."

# Check if nginx is already installed
if command -v nginx &> /dev/null; then
    echo "✅ Nginx is already installed"
    nginx -V 2>&1 | grep -o with-http_mp4_module && echo "✅ MP4 module is available" || echo "⚠️  MP4 module not available"
    nginx -V 2>&1 | grep -o with-http_flv_module && echo "✅ FLV module is available" || echo "⚠️  FLV module not available"
else
    # Install nginx with extra modules
    sudo apt install -y nginx-full nginx-extras
fi

# Install additional tools for media processing
echo "🔧 Installing media processing tools..."
sudo apt install -y \
    ffmpeg \
    mediainfo \
    curl \
    wget

# Create directories for media streaming
echo "📁 Creating media directories..."
sudo mkdir -p /var/www/media/{hls,dash,recordings}
sudo chown -R www-data:www-data /var/www/media
sudo chmod -R 755 /var/www/media

# Backup existing nginx configuration
echo "💾 Backing up existing nginx configuration..."
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# Create optimized nginx.conf for media streaming
echo "⚙️  Creating optimized nginx configuration..."
sudo tee /etc/nginx/conf.d/media-streaming.conf << 'EOF'
# Media streaming optimizations
client_max_body_size 100M;
client_body_buffer_size 1M;

# Enable sendfile for efficient file transfers
sendfile on;
tcp_nopush on;
tcp_nodelay on;

# Connection settings
keepalive_timeout 65;
keepalive_requests 100;

# Buffer settings for streaming
proxy_buffering off;
proxy_cache off;
proxy_request_buffering off;

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=media:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=websocket:10m rate=5r/s;

# WebSocket upgrade mapping
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# MIME types for media files
location ~* \.(m3u8)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
}

location ~* \.(ts)$ {
    expires 1h;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin "*";
}
EOF

# Copy your existing configuration with media streaming enhancements
echo "📋 Updating your kimiya-voice nginx configuration..."
sudo cp kimiya-voice.nginx.conf /etc/nginx/sites-available/kimiya-voice
sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed"
    echo "Please check the configuration and try again"
    exit 1
fi

# Create a simple media streaming test
echo "🎯 Creating media streaming test..."
cat > test-media-streaming.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Media Streaming Test</title>
</head>
<body>
    <h1>Media Streaming Test</h1>
    
    <h2>WebSocket Connection Test</h2>
    <button onclick="testWebSocket()">Test WebSocket</button>
    <div id="ws-status"></div>
    
    <h2>Audio Streaming Test</h2>
    <audio controls>
        <source src="/api/media/test.mp3" type="audio/mpeg">
        Your browser does not support the audio element.
    </audio>
    
    <script>
        function testWebSocket() {
            const status = document.getElementById('ws-status');
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(`${protocol}//${window.location.host}/api/conversationrelay-ws`);
            
            ws.onopen = function() {
                status.innerHTML = '<span style="color: green;">✅ WebSocket connected successfully!</span>';
                ws.close();
            };
            
            ws.onerror = function() {
                status.innerHTML = '<span style="color: red;">❌ WebSocket connection failed</span>';
            };
            
            ws.onclose = function() {
                console.log('WebSocket connection closed');
            };
        }
    </script>
</body>
</html>
EOF

sudo mv test-media-streaming.html /var/www/kimiya-voice-devdist/

echo ""
echo "🎉 Nginx Media Streaming Setup Complete!"
echo ""
echo "📊 Configuration Summary:"
echo "  ✅ Nginx with media streaming modules installed"
echo "  ✅ Media directories created: /var/www/media/"
echo "  ✅ Rate limiting configured for API and media endpoints"
echo "  ✅ WebSocket support optimized for real-time audio"
echo "  ✅ Buffer settings optimized for streaming"
echo "  ✅ CORS headers configured for media files"
echo ""
echo "🧪 Test your setup:"
echo "  • Visit: http://your-domain/test-media-streaming.html"
echo "  • Check WebSocket connection"
echo "  • Monitor nginx logs: sudo tail -f /var/log/nginx/access.log"
echo ""
echo "📝 Next steps:"
echo "  1. Test your real-time audio streaming"
echo "  2. Monitor performance with: sudo nginx -s reload"
echo "  3. Check media streaming endpoints"
echo ""
echo "🔧 Troubleshooting:"
echo "  • Check nginx status: sudo systemctl status nginx"
echo "  • Test configuration: sudo nginx -t"
echo "  • View error logs: sudo tail -f /var/log/nginx/error.log"
