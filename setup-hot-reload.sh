#!/bin/bash

# Hot Reload Setup Script for Development Environment
# This script ensures nginx is configured to proxy to Vite dev server instead of serving static files

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

# Function to setup nginx for hot reload
setup_nginx_hot_reload() {
    print_header "SETTING UP NGINX FOR HOT RELOAD"
    
    local nginx_sites_dir="/etc/nginx/sites-available"
    local nginx_enabled_dir="/etc/nginx/sites-enabled"
    local config_name="kimiya-voice-dev"
    
    # Check if nginx directories exist
    if [ ! -d "$nginx_sites_dir" ]; then
        print_error "Nginx sites-available directory not found: $nginx_sites_dir"
        return 1
    fi
    
    # Copy our nginx-dev.conf to sites-available
    print_status "Copying nginx configuration for hot reload..."
    sudo cp "$DEV_DIR/nginx-dev.conf" "$nginx_sites_dir/$config_name"
    
    # Enable the site
    print_status "Enabling nginx site configuration..."
    if [ -L "$nginx_enabled_dir/$config_name" ]; then
        print_status "Configuration already enabled"
    else
        sudo ln -s "$nginx_sites_dir/$config_name" "$nginx_enabled_dir/$config_name"
        print_success "Nginx site enabled"
    fi
    
    # Test nginx configuration
    print_status "Testing nginx configuration..."
    if sudo nginx -t; then
        print_success "Nginx configuration is valid"
        
        # Reload nginx
        print_status "Reloading nginx..."
        sudo systemctl reload nginx
        print_success "Nginx reloaded with hot reload configuration"
    else
        print_error "Nginx configuration test failed"
        return 1
    fi
}

# Function to ensure development dependencies are installed
ensure_dev_dependencies() {
    print_header "ENSURING DEVELOPMENT DEPENDENCIES"
    
    cd "$DEV_DIR"
    
    # Check if node_modules exists and is up to date
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_status "Installing/updating npm dependencies..."
        npm install
        print_success "Dependencies installed"
    else
        print_success "Dependencies are up to date"
    fi
}

# Function to setup PM2 for backend hot reload
setup_backend_hot_reload() {
    print_header "SETTING UP BACKEND HOT RELOAD"
    
    # Check if PM2 is installed
    if ! command -v pm2 >/dev/null 2>&1; then
        print_error "PM2 is not installed. Please install PM2 first:"
        print_status "npm install -g pm2"
        return 1
    fi
    
    # Stop existing backend if running
    if pm2 list | grep -q "kimiya-voice-backend-dev"; then
        print_status "Stopping existing backend process..."
        pm2 stop kimiya-voice-backend-dev
        pm2 delete kimiya-voice-backend-dev
    fi
    
    # Start backend with hot reload
    print_status "Starting backend with hot reload..."
    cd "$DEV_DIR"
    NODE_ENV=development pm2 start config/pm2/development.config.cjs
    pm2 save
    
    print_success "Backend started with hot reload enabled"
}

# Function to create development environment file
create_dev_env() {
    print_header "CREATING DEVELOPMENT ENVIRONMENT FILE"
    
    local env_file="$DEV_DIR/.env.development"
    
    if [ ! -f "$env_file" ]; then
        print_status "Creating .env.development file..."
        cat > "$env_file" << EOF
# Development Environment Configuration
NODE_ENV=development
VITE_API_URL=http://localhost:3010
VITE_WS_URL=ws://localhost:3010
VITE_HMR_PORT=3001

# Backend Configuration
PORT=3010
FRONTEND_URL=http://localhost:3000

# Development Features
VITE_DEV_TOOLS=true
VITE_HOT_RELOAD=true
EOF
        print_success "Development environment file created"
    else
        print_success "Development environment file already exists"
    fi
}

# Main setup function
main() {
    print_header "HOT RELOAD SETUP FOR DEVELOPMENT ENVIRONMENT"
    
    # Check if we're in the correct directory
    if [ ! -d "$DEV_DIR" ]; then
        print_error "Development directory not found: $DEV_DIR"
        exit 1
    fi
    
    # Check if running as root for nginx operations
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is needed for nginx configuration."
    else
        print_status "Some operations may require sudo privileges for nginx configuration."
    fi
    
    # Run setup steps
    ensure_dev_dependencies
    create_dev_env
    setup_nginx_hot_reload
    setup_backend_hot_reload
    
    print_header "SETUP COMPLETE"
    print_success "Hot reload setup completed successfully! 🎉"
    print_status ""
    print_status "Next steps:"
    print_status "1. Run: ./start-dev-server.sh"
    print_status "2. Access your app at: https://dev-ai-phone-call.kimiyi.ai"
    print_status "3. Validate setup: ./validate-dev-environment.sh"
    print_status ""
    print_status "🔥 Hot reload is now enabled for:"
    print_status "  • Frontend (Vite HMR)"
    print_status "  • Backend (PM2 watch mode)"
    print_status "  • Nginx proxy configuration"
}

# Run main function
main "$@"
