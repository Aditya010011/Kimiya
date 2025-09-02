#!/bin/bash

# Quick Deployment Script for Call Flow Weaver on Ubuntu Server
# Run this script on your Ubuntu server after uploading your project files

set -e

echo "🚀 Starting Call Flow Weaver deployment on Ubuntu server..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
print_status "Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
fi

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx htop

# Install PM2
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    print_status "PM2 already installed: $(pm2 --version)"
fi

# Create application directory
APP_DIR="/var/www/kimiya-voice"
print_status "Setting up application directory: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Check if we're already in the project directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from your project root directory."
    exit 1
fi

# Copy project files to application directory
if [[ "$PWD" != "$APP_DIR" ]]; then
    print_status "Copying project files to $APP_DIR..."
    sudo cp -r . $APP_DIR/
    sudo chown -R $USER:$USER $APP_DIR
    cd $APP_DIR
fi

# Install dependencies
print_status "Installing frontend dependencies..."
npm install

print_status "Installing backend dependencies..."
cd backend
npm install
cd ..

# Create environment files
print_status "Creating environment configuration..."

# Backend environment
if [[ ! -f "backend/.env" ]]; then
    cat > backend/.env << EOF
NODE_ENV=production
PORT=3001

# Twilio Configuration (replace with your values)
TWILIO_ACCOUNT_SID=AC64208c7087a03b475ea7fa9337b692f8
TWILIO_AUTH_TOKEN=ab39243ee151ff74a03075d53070cf67
TWILIO_PHONE_NUMBER=+17077433838

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://innochattemp.openai.azure.com/openai/deployments/gpt4omini/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=f6d564a83af3498c9beb46d7d3e3da96

# Add other API keys as needed
# ELEVENLABS_API_KEY=your_elevenlabs_api_key
EOF
    print_warning "Backend .env file created with default values. Please update with your actual credentials."
else
    print_status "Backend .env file already exists."
fi

# Frontend environment
if [[ ! -f ".env" ]]; then
    cat > .env << EOF
VITE_API_URL=http://localhost:3001
EOF
    print_status "Frontend .env file created."
fi

# Build frontend
print_status "Building frontend for production..."
npm run build

# Create PM2 ecosystem file (ES module compatible)
print_status "Creating PM2 configuration..."
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'kimiya-voice-backend',
    script: './backend/server.js',
    cwd: '$APP_DIR',
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
print_status "Starting backend with PM2..."
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Configure Nginx
print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/kimiya-voice << EOF
server {
    listen 80;
    server_name _;  # Accept any domain name
    
    # Frontend (React app)
    location / {
        root $APP_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
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
    
    # WebSocket support
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
        root $APP_DIR/dist;
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
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Create deployment script for future updates
print_status "Creating deployment script..."
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting deployment..."

# Pull latest changes (if using git)
# git pull origin main

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

print_status "✅ Deployment completed successfully!"
echo ""
print_status "🌐 Your application should now be accessible at:"
print_status "   Frontend: http://$(curl -s ifconfig.me)"
print_status "   Backend API: http://$(curl -s ifconfig.me)/api"
echo ""
print_status "📋 Useful commands:"
print_status "   View PM2 processes: pm2 list"
print_status "   View backend logs: pm2 logs kimiya-voice-backend"
print_status "   View nginx logs: sudo tail -f /var/log/nginx/access.log"
print_status "   Restart backend: pm2 restart kimiya-voice-backend"
print_status "   Deploy updates: ./deploy.sh"
echo ""
print_warning "⚠️  Don't forget to:"
print_warning "   1. Update backend/.env with your actual API credentials"
print_warning "   2. Configure your domain name in Nginx if you have one"
print_warning "   3. Set up SSL certificate with: sudo certbot --nginx"
print_warning "   4. Test all functionality including Twilio integration"
