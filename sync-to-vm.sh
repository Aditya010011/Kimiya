#!/bin/bash

# Sync local changes to VM
# Run this script after making local changes

set -e

# Configuration
SERVER_IP="20.255.99.49"
SERVER_USER="azureuser"
SSH_KEY_PATH="C:\Users\ahada\Desktop\Kimiyi\AI-Phone_key.pem"
REMOTE_DIR="/var/www/kimiya-voice"
LOCAL_DIR="."

echo "🔄 Syncing local changes to VM..."

# Create temporary archive
TEMP_ARCHIVE="sync-$(date +%Y%m%d_%H%M%S).tar.gz"

# Create archive excluding unnecessary files
tar -czf "$TEMP_ARCHIVE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='backend/logs' \
    --exclude="$TEMP_ARCHIVE" \
    . 2>/dev/null || true

echo "📤 Uploading changes..."
scp -i "$SSH_KEY_PATH" "$TEMP_ARCHIVE" "$SERVER_USER@$SERVER_IP:/tmp/"

echo "📦 Extracting on VM..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "
    cd $REMOTE_DIR && 
    tar -xzf /tmp/$TEMP_ARCHIVE && 
    rm /tmp/$TEMP_ARCHIVE
"

# Clean up local archive
rm "$TEMP_ARCHIVE"

echo "🔄 Rebuilding and restarting..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" "
    cd $REMOTE_DIR && 
    npm install &&
    cd backend && npm install && cd .. &&
    npm run build &&
    pm2 restart kimiya-voice-backend
"

echo "✅ Sync completed successfully!"
echo "🌐 Your changes are live at: http://$SERVER_IP"
