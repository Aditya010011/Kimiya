# Ubuntu Server Deployment Guide for Kimiya Voice

This guide will help you deploy the Kimiya Voice project on your Ubuntu server VM.

## Prerequisites

- Ubuntu server with SSH access
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Node.js (using NodeSource repository for latest LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/kimiya-voice
sudo chown -R $USER:$USER /var/www/kimiya-voice
```

### 2. Clone and Setup Project

```bash
# Navigate to application directory
cd /var/www/kimiya-voice

# Clone your project (replace with your repository URL)
git clone <your-repo-url> .

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Environment Configuration

Create environment files for both frontend and backend:

```bash
# Create backend environment file
cat > backend/.env << EOF
NODE_ENV=production
PORT=3001

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://innochattemp.openai.azure.com/openai/deployments/gpt4omini/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=f6d564a83af3498c9beb46d7d3e3da96

# Other API keys as needed
ELEVENLABS_API_KEY=your_elevenlabs_api_key
EOF

# Create frontend environment file (if needed)
cat > .env << EOF
VITE_API_URL=http://your-server-ip:3001
# Add other frontend environment variables as needed
EOF
```

### 4. Build Frontend

```bash
# Build the frontend for production
npm run build
```

### 5. Configure PM2 for Backend

Create PM2 ecosystem file:

```bash
cat > ecosystem.config.js << EOF
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

# Start the backend with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Configure Nginx

Create Nginx configuration:

```bash
sudo tee /etc/nginx/sites-available/kimiya-voice << EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain
    
    # Frontend (React app)
    location / {
        root /var/www/kimiya-voice/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support for real-time features
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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
sudo ln -s /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL Certificate (Optional but Recommended)

```bash
# Install SSL certificate using Let's Encrypt
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal setup (usually done automatically)
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Deployment Scripts

Create deployment scripts for easy updates:

```bash
# Create deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting deployment..."

# Pull latest changes
git pull origin main

# Install/update dependencies
echo "Installing frontend dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# Build frontend
echo "Building frontend..."
npm run build

# Restart backend
echo "Restarting backend..."
pm2 restart kimiya-voice-backend

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo "Deployment completed successfully!"
EOF

chmod +x deploy.sh
```

## Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## Monitoring and Logs

```bash
# View PM2 processes
pm2 list
pm2 logs kimiya-voice-backend

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Monitor system resources
htop
```

## Backup Strategy

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/kimiya-voice"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/kimiya-voice --exclude=node_modules --exclude=dist

# Keep only last 7 backups
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/app_$DATE.tar.gz"
EOF

chmod +x backup.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/kimiya-voice/backup.sh") | crontab -
```

## Next Steps

1. Replace placeholder values in environment files with your actual credentials
2. Update the domain name in Nginx configuration
3. Test the deployment thoroughly
4. Set up monitoring and alerting as needed
5. Configure automated backups

## Troubleshooting

- Check PM2 logs: `pm2 logs`
- Check Nginx status: `sudo systemctl status nginx`
- Check application logs: `tail -f backend/logs/combined.log`
- Verify ports are open: `sudo netstat -tlnp | grep :3001`
