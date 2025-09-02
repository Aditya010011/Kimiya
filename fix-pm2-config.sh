#!/bin/bash

# Quick fix for PM2 configuration issue
# Run this on your server to continue the deployment

set -e

echo "🔧 Fixing PM2 configuration for ES modules..."

# Navigate to application directory
cd /var/www/kimiya-voice

# Remove the problematic config file
rm -f ecosystem.config.js

# Create a proper CommonJS config file
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'kimiya-voice-backend',
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './backend/logs/err.log',
    out_file: './backend/logs/out.log',
    log_file: './backend/logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# Create logs directory
mkdir -p backend/logs

# Start backend with PM2
echo "🚀 Starting backend with PM2..."
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/kimiya-voice << 'EOF'
server {
    listen 80;
    server_name _;  # Accept any domain name
    
    # Frontend (React app)
    location / {
        root /var/www/kimiya-voice/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /var/www/kimiya-voice/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your application should now be accessible at:"
echo "   http://$(curl -s ifconfig.me)"
echo ""
echo "📋 Useful commands:"
echo "   View PM2 processes: pm2 list"
echo "   View backend logs: pm2 logs kimiya-voice-backend"
echo "   Restart backend: pm2 restart kimiya-voice-backend"
