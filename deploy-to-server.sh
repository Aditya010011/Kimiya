#!/bin/bash

# Deploy Kimiya Voice to Ubuntu Server via SSH
# Run this script from your local machine

set -e

# Configuration - Update these values
SERVER_IP="20.255.99.49"
SERVER_USER="azureuser"
SSH_KEY_PATH="C:\Users\ahada\Desktop\Kimiyi\AI-Phone_key.pem"
REMOTE_DIR="/var/www/kimiya-voice-dev

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if configuration is set
if [[ "$SERVER_IP" == "your-server-ip" ]] || [[ "$SERVER_USER" == "your-username" ]] || [[ "$SSH_KEY_PATH" == "path/to/your/ssh/key" ]]; then
    print_error "Please update the configuration variables at the top of this script:"
    print_error "  SERVER_IP: Your Ubuntu server IP address"
    print_error "  SERVER_USER: Your username on the server"
    print_error "  SSH_KEY_PATH: Path to your SSH private key"
    exit 1
fi

# Check if SSH key exists
if [[ ! -f "$SSH_KEY_PATH" ]]; then
    print_error "SSH key not found at: $SSH_KEY_PATH"
    exit 1
fi

# Check if we're in the project directory
if [[ ! -f "package.json" ]]; then
    print_error "package.json not found. Please run this script from your project root directory."
    exit 1
fi

print_status "🚀 Starting Kimiya Voice deployment to Ubuntu server..."
print_status "Server: $SERVER_USER@$SERVER_IP"

# Test SSH connection
print_status "Testing SSH connection..."
if ! ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo 'SSH connection successful'"; then
    print_error "Failed to connect to server. Please check your SSH configuration."
    exit 1
fi

# Create remote directory
print_status "Creating remote directory..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "sudo mkdir -p $REMOTE_DIR && sudo chown -R $SERVER_USER:$SERVER_USER $REMOTE_DIR"

# Create a temporary archive and upload (since rsync is not available in Git Bash)
print_status "Creating temporary archive..."
TEMP_ARCHIVE="kimiya-voice-deploy.tar.gz"

# Create archive excluding unnecessary files (suppress harmless warnings)
tar -czf "$TEMP_ARCHIVE" \
    --exclude='node_modules' \
    --exclude='backend/node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.env.local' \
    --exclude='.DS_Store' \
    --exclude='backend/logs' \
    --exclude='bun.lockb' \
    --exclude='.vscode' \
    --exclude='.idea' \
    --exclude='*.tmp' \
    --exclude='*.temp' \
    --exclude="$TEMP_ARCHIVE" \
    . 2>/dev/null || true

print_status "Uploading project files..."
scp -i "$SSH_KEY_PATH" "$TEMP_ARCHIVE" "$SERVER_USER@$SERVER_IP:/tmp/"

print_status "Extracting files on server..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "
    cd $REMOTE_DIR &&
    tar -xzf /tmp/$TEMP_ARCHIVE &&
    rm /tmp/$TEMP_ARCHIVE
"

# Clean up local archive
rm "$TEMP_ARCHIVE"

# Make deployment script executable
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "chmod +x $REMOTE_DIR/quick-deploy.sh"

# Fix PM2 config issue first (ES modules compatibility)
print_status "Fixing PM2 configuration for ES modules..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "
    cd $REMOTE_DIR &&
    sed -i 's/ecosystem.config.js/ecosystem.config.cjs/g' quick-deploy.sh &&
    sed -i 's/cat > ecosystem.config.js/cat > ecosystem.config.cjs/g' quick-deploy.sh
"

# Run deployment script on server
print_status "Running deployment script on server..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "cd $REMOTE_DIR && ./quick-deploy.sh"

# Get server IP for final message
SERVER_PUBLIC_IP=$(ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "curl -s ifconfig.me")

print_status "✅ Deployment completed successfully!"
echo ""
print_status "🌐 Your application is now accessible at:"
print_status "   http://$SERVER_PUBLIC_IP"
echo ""
print_status "📋 To manage your application:"
print_status "   SSH into server: ssh -i $SSH_KEY_PATH $SERVER_USER@$SERVER_IP"
print_status "   View logs: pm2 logs kimiya-voice-backend"
print_status "   Restart app: pm2 restart kimiya-voice-backend"
echo ""
print_warning "⚠️  Next steps:"
print_warning "   1. SSH into your server and update backend/.env with your actual API credentials"
print_warning "   2. Test the application thoroughly"
print_warning "   3. Set up SSL certificate if you have a domain name"

# Restart PM2 with updated environment variables
pm2 restart kimiya-voice-backend --update-env

# Test the health endpoint
curl http://localhost/api/health/