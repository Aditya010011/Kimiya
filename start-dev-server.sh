#!/bin/bash

# Quick Development Server Startup Script
# This script starts both backend and frontend development servers

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DEV_DIR="/var/www/kimiya-voice-dev"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

if [ ! -d "$DEV_DIR" ]; then
    echo "Development directory not found: $DEV_DIR"
    exit 1
fi

cd "$DEV_DIR"

print_header "STARTING DEVELOPMENT ENVIRONMENT"

# Check if backend is already running
if pm2 list | grep -q "kimiya-voice-backend-dev"; then
    print_status "Development backend is already running"
else
    print_status "Starting development backend..."
    NODE_ENV=development pm2 start config/pm2/development.config.cjs
    pm2 save
fi

print_status "Backend running on: http://localhost:3010"
print_status "API endpoints available at: http://localhost:3010/api/"

print_header "FRONTEND DEVELOPMENT SERVER"
print_status "Starting Vite development server..."
print_status "Frontend will be available at: http://localhost:3000"
print_status "Press Ctrl+C to stop the frontend server"

# Start frontend development server
npm run dev
