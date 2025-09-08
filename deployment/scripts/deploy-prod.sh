#!/bin/bash

# Kimiya Voice Production Deployment Script
# This script deploys the application to production environment

set -e  # Exit on any error

echo "🚀 Kimiya Voice Production Deployment"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="/var/backups/kimiya-voice"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$PROJECT_DIR"

print_step "Starting production deployment in: $PROJECT_DIR"

# Step 1: Pre-deployment checks
print_step "Running pre-deployment checks..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the right directory?"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required for production. Current: $(node --version)"
    exit 1
fi

print_status "Pre-deployment checks passed ✓"

# Step 2: Create backup
print_step "Creating backup..."
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/kimiya-voice-backup-$TIMESTAMP.tar.gz" \
    --exclude=node_modules \
    --exclude=apps/*/node_modules \
    --exclude=backend/node_modules \
    --exclude=logs \
    --exclude=dist \
    --exclude=apps/*/dist \
    .

print_status "Backup created: $BACKUP_DIR/kimiya-voice-backup-$TIMESTAMP.tar.gz"

# Step 3: Install dependencies
print_step "Installing production dependencies..."

# Install frontend dependencies
if [ -d "apps/frontend" ]; then
    print_status "Installing frontend dependencies..."
    cd apps/frontend
    npm ci --production=false  # Need dev dependencies for build
    cd "$PROJECT_DIR"
else
    print_status "Installing root frontend dependencies..."
    npm ci --production=false
fi

# Install backend dependencies
if [ -d "apps/backend" ]; then
    print_status "Installing backend dependencies..."
    cd apps/backend
    npm ci --only=production
    cd "$PROJECT_DIR"
else
    print_status "Installing backend dependencies..."
    cd backend
    npm ci --only=production
    cd "$PROJECT_DIR"
fi

# Step 4: Build frontend
print_step "Building frontend for production..."

if [ -d "apps/frontend" ]; then
    cd apps/frontend
    npm run build
    cd "$PROJECT_DIR"
    print_status "Frontend built in apps/frontend/dist"
else
    npm run build
    print_status "Frontend built in dist"
fi

# Step 5: Set up production environment
print_step "Setting up production environment..."

# Create production environment file if it doesn't exist
if [ ! -f ".env.production" ]; then
    if [ -f "config/environments/production.env" ]; then
        cp config/environments/production.env .env.production
        print_status "Created .env.production from template"
    else
        print_warning "No production environment template found"
    fi
fi

# Ensure log directories exist
mkdir -p logs/{frontend,backend,nginx}

# Step 6: Configure PM2 for production
print_step "Configuring PM2 for production..."

if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Install with: npm install -g pm2"
    exit 1
fi

# Stop existing processes
pm2 delete kimiya-voice-backend-prod 2>/dev/null || true
pm2 delete kimiya-voice-backend 2>/dev/null || true

# Start with appropriate config
if [ -f "config/pm2/production.config.js" ]; then
    pm2 start config/pm2/production.config.js
    print_status "Started with professional PM2 config"
elif [ -f "ecosystem.config.cjs" ]; then
    # Update legacy config for production
    sed -i 's/NODE_ENV.*development/NODE_ENV: "production"/' ecosystem.config.cjs
    pm2 start ecosystem.config.cjs
    print_status "Started with updated legacy PM2 config"
else
    print_error "No PM2 configuration found"
    exit 1
fi

pm2 save
pm2 startup

# Step 7: Configure Nginx
print_step "Configuring Nginx..."

# Use appropriate nginx config
if [ -f "config/nginx/production.conf" ]; then
    sudo cp config/nginx/production.conf /etc/nginx/sites-available/kimiya-voice
    print_status "Installed professional nginx config"
elif [ -f "kimiya-voice.nginx.conf" ]; then
    sudo cp kimiya-voice.nginx.conf /etc/nginx/sites-available/kimiya-voice
    print_status "Installed legacy nginx config"
else
    print_warning "No nginx configuration found"
fi

# Enable site
sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Step 8: Set up SSL (if domain is configured)
print_step "Checking SSL configuration..."

if [ -f "/etc/nginx/sites-available/kimiya-voice" ]; then
    if grep -q "server_name.*\..*;" /etc/nginx/sites-available/kimiya-voice; then
        DOMAIN=$(grep "server_name" /etc/nginx/sites-available/kimiya-voice | head -1 | sed 's/.*server_name \([^;]*\);.*/\1/' | awk '{print $1}')
        if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "_" ]; then
            print_status "Domain found: $DOMAIN"
            if command -v certbot &> /dev/null; then
                print_status "Setting up SSL with Let's Encrypt..."
                sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" || print_warning "SSL setup failed"
            else
                print_warning "Certbot not installed. Install with: sudo apt install certbot python3-certbot-nginx"
            fi
        fi
    fi
fi

# Step 9: Final health checks
print_step "Running health checks..."

# Wait for services to start
sleep 5

# Check PM2 status
pm2 status

# Check if backend is responding
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend health check passed ✓"
else
    print_warning "Backend health check failed"
fi

# Check nginx status
if sudo systemctl is-active --quiet nginx; then
    print_status "Nginx is running ✓"
else
    print_error "Nginx is not running"
fi

# Step 10: Cleanup
print_step "Cleaning up..."

# Remove old backups (keep last 5)
find "$BACKUP_DIR" -name "kimiya-voice-backup-*.tar.gz" -type f | sort -r | tail -n +6 | xargs rm -f 2>/dev/null || true

print_step "Production deployment completed!"
print_status "Services status:"
echo "  • Backend: http://localhost:3001"
echo "  • Frontend: Served by Nginx"
echo "  • Logs: $PROJECT_DIR/logs/"
echo "  • Backup: $BACKUP_DIR/kimiya-voice-backup-$TIMESTAMP.tar.gz"
echo ""
print_status "Deployment successful! 🎉"

# Display final status
echo ""
echo "📊 Final Status:"
echo "================"
pm2 status
echo ""
sudo systemctl status nginx --no-pager -l | head -10
