#!/bin/bash

# Development Environment Validation Script
# Ensures hot reload is working properly for both frontend and backend

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
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
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

# Function to check if Vite dev server is running
check_vite_dev_server() {
    print_status "Checking Vite development server..."
    
    if ! check_port 3000; then
        print_error "Vite dev server is not running on port 3000"
        return 1
    fi
    
    # Check if it's actually Vite by looking for HMR endpoint
    if curl -s --connect-timeout 5 http://localhost:3000 | grep -q "vite" 2>/dev/null; then
        print_success "Vite dev server is running with hot reload"
        return 0
    else
        print_warning "Port 3000 is occupied but may not be Vite dev server"
        return 1
    fi
}

# Function to check backend hot reload
check_backend_hot_reload() {
    print_status "Checking backend hot reload configuration..."
    
    if ! check_port 3010; then
        print_error "Backend server is not running on port 3010"
        return 1
    fi
    
    # Check if PM2 process exists and has watch enabled
    if pm2 list | grep -q "kimiya-voice-backend-dev.*online"; then
        print_success "Backend is running via PM2"
        
        # Check if watch mode is enabled
        if pm2 show kimiya-voice-backend-dev | grep -q "watch & reload.*✔"; then
            print_success "Backend hot reload (watch mode) is enabled"
            return 0
        elif pm2 show kimiya-voice-backend-dev | grep -q "watch.*true"; then
            print_success "Backend hot reload (watch mode) is enabled"
            return 0
        else
            print_warning "Backend is running but watch mode may not be enabled"
            return 1
        fi
    else
        print_error "Backend PM2 process not found or not online"
        return 1
    fi
}

# Function to check nginx configuration
check_nginx_config() {
    print_status "Checking nginx configuration for hot reload..."
    
    local nginx_config="/etc/nginx/sites-enabled/kimiya-voice-dev"
    
    if [ ! -f "$nginx_config" ]; then
        print_warning "Nginx config not found at $nginx_config"
        print_status "Checking if nginx-dev.conf is being used..."
        
        if nginx -t 2>&1 | grep -q "nginx-dev.conf"; then
            print_success "nginx-dev.conf is being used"
        else
            print_error "Cannot determine nginx configuration status"
            return 1
        fi
    fi
    
    # Check if nginx is proxying to Vite dev server
    if curl -s --connect-timeout 5 https://dev-ai-phone-call.kimiyi.ai 2>/dev/null | grep -q "vite" 2>/dev/null; then
        print_success "Nginx is correctly proxying to Vite dev server"
        return 0
    else
        print_error "Nginx may be serving static files instead of proxying to dev server"
        return 1
    fi
}

# Function to check WebSocket connectivity for HMR
check_websocket_hmr() {
    print_status "Checking WebSocket connectivity for Hot Module Replacement..."
    
    # This is a basic check - in a real scenario you might want to use a WebSocket client
    if check_port 3001; then  # HMR port (3000 + 1)
        print_success "HMR WebSocket port (3001) is available"
        return 0
    else
        print_warning "HMR WebSocket port (3001) is not available"
        print_status "This may be normal if HMR is using the same port as the dev server"
        return 0
    fi
}

# Function to validate file watching
validate_file_watching() {
    print_status "Validating file watching capabilities..."
    
    cd "$DEV_DIR"
    
    # Check if inotify is available (Linux file watching)
    if command -v inotifywait >/dev/null 2>&1; then
        print_success "inotify tools are available for file watching"
    else
        print_warning "inotify tools not found - file watching may use polling"
    fi
    
    # Check if the source directory exists
    if [ -d "src" ]; then
        print_success "Source directory exists and can be watched"
    else
        print_error "Source directory not found"
        return 1
    fi
    
    return 0
}

# Main validation function
main() {
    print_header "DEVELOPMENT ENVIRONMENT HOT RELOAD VALIDATION"
    
    local errors=0
    
    # Change to development directory
    if [ ! -d "$DEV_DIR" ]; then
        print_error "Development directory not found: $DEV_DIR"
        exit 1
    fi
    
    cd "$DEV_DIR"
    
    # Run all checks
    print_header "FRONTEND HOT RELOAD VALIDATION"
    if ! check_vite_dev_server; then
        ((errors++))
    fi
    
    if ! check_websocket_hmr; then
        ((errors++))
    fi
    
    print_header "BACKEND HOT RELOAD VALIDATION"
    if ! check_backend_hot_reload; then
        ((errors++))
    fi
    
    print_header "NGINX PROXY VALIDATION"
    if ! check_nginx_config; then
        ((errors++))
    fi
    
    print_header "FILE WATCHING VALIDATION"
    if ! validate_file_watching; then
        ((errors++))
    fi
    
    # Summary
    print_header "VALIDATION SUMMARY"
    
    if [ $errors -eq 0 ]; then
        print_success "All hot reload validations passed! 🎉"
        print_success "Your development environment is properly configured for hot reload"
        print_status ""
        print_status "🌐 Access your app at: https://dev-ai-phone-call.kimiyi.ai"
        print_status "🔥 Hot reload is active for both frontend and backend"
        print_status "📝 File changes will be automatically reflected"
    else
        print_error "Found $errors issue(s) with hot reload configuration"
        print_status ""
        print_status "🔧 To fix issues:"
        print_status "  1. Run: ./start-dev-server.sh"
        print_status "  2. Ensure nginx is using the correct configuration"
        print_status "  3. Check PM2 backend process: pm2 list"
        exit 1
    fi
}

# Run main function
main
