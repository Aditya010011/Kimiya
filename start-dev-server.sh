#!/bin/bash

# Enhanced Development Server Startup Script
# This script starts both backend and frontend development servers with hot reload
# Optimized for https://dev-ai-phone-call.kimiyi.ai/

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEV_DIR="/var/www/kimiya-voice-dev"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to validate development environment
validate_dev_environment() {
    print_header "VALIDATING DEVELOPMENT ENVIRONMENT"

    # Check if we're in the correct directory
    if [ ! -d "$DEV_DIR" ]; then
        print_error "Development directory not found: $DEV_DIR"
        exit 1
    fi

    # Check if package.json exists
    if [ ! -f "$DEV_DIR/package.json" ]; then
        print_error "package.json not found in $DEV_DIR"
        exit 1
    fi

    # Check if node_modules exists
    if [ ! -d "$DEV_DIR/node_modules" ]; then
        print_warning "node_modules not found. Running npm install..."
        cd "$DEV_DIR"
        npm install
    fi

    print_success "Development environment validation complete"
}

# Main execution
main() {
    # Validate environment first
    validate_dev_environment

    cd "$DEV_DIR"

    print_header "STARTING DEVELOPMENT ENVIRONMENT WITH HOT RELOAD"

    # Set NODE_ENV to development
    export NODE_ENV=development

    # Check port availability
    print_status "Checking port availability..."

    if check_port 3000; then
        print_warning "Port 3000 is already in use. Checking if it's our Vite dev server..."
        if curl -s http://localhost:3000 | grep -q "vite" 2>/dev/null; then
            print_status "Vite dev server is already running on port 3000"
        else
            print_error "Port 3000 is occupied by another service. Please free the port and try again."
            exit 1
        fi
    fi

    if check_port 3010; then
        print_status "Port 3010 is in use (likely by backend)"
    fi

    # Check if backend is already running
    if pm2 list | grep -q "kimiya-voice-backend-dev"; then
        print_status "Development backend is already running with hot reload"
        print_status "Restarting backend to ensure latest configuration..."
        pm2 restart kimiya-voice-backend-dev
    else
        print_status "Starting development backend with hot reload..."
        NODE_ENV=development pm2 start config/pm2/development.config.cjs
        pm2 save
        sleep 2  # Give backend time to start
    fi

    # Verify backend is running
    if ! pm2 list | grep -q "kimiya-voice-backend-dev.*online"; then
        print_error "Failed to start backend server"
        exit 1
    fi

    print_success "Backend running on: http://localhost:3010 (with hot reload)"
    print_success "API endpoints available at: http://localhost:3010/api/"

    print_header "FRONTEND DEVELOPMENT SERVER WITH HOT RELOAD"
    print_status "Starting Vite development server with enhanced hot reload..."
    print_success "🌐 Development URLs:"
    print_success "  • Local:     http://localhost:3000"
    print_success "  • Network:   https://dev-ai-phone-call.kimiyi.ai"
    print_success "  • Backend:   http://localhost:3010"
    print_status ""
    print_status "🔥 Hot reload is enabled for both frontend and backend"
    print_status "📝 File changes will be automatically reflected"
    print_status "🔄 WebSocket connection established for HMR"
    print_status ""
    print_status "Press Ctrl+C to stop the frontend server"
    print_status "Backend will continue running in PM2 (use 'pm2 stop kimiya-voice-backend-dev' to stop)"

    # Start frontend development server with enhanced settings
    npm run dev
}

# Cleanup function for graceful shutdown
cleanup() {
    print_status ""
    print_status "Shutting down development server..."
    print_status "Backend continues running in PM2"
    print_status "Use 'pm2 stop kimiya-voice-backend-dev' to stop backend"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Run main function
main
