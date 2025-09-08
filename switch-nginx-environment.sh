#!/bin/bash

# Kimiya Voice Nginx Environment Switcher
# This script switches nginx configuration between development and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

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

# Function to deploy development nginx configuration
deploy_development() {
    print_header "DEPLOYING DEVELOPMENT NGINX CONFIGURATION"
    
    print_status "This will configure nginx to:"
    echo "  • Serve frontend from: /var/www/kimiya-voice-dev/dist"
    echo "  • Proxy API calls to: http://localhost:3010 (development backend)"
    echo "  • HTTP access: http://localhost:8080"
    echo "  • HTTPS access: https://localhost:8443"
    echo ""
    
    # Check if development backend is running
    if ! pm2 list | grep -q "kimiya-voice-backend-dev.*online"; then
        print_warning "Development backend is not running. Starting it now..."
        ./manage-environments.sh start-dev
    fi
    
    # Build development frontend
    print_status "Building development frontend..."
    cd /var/www/kimiya-voice-dev
    npm run build
    cd /var/www/kimiya-voice
    
    # Deploy nginx configuration
    print_status "Deploying development nginx configuration..."
    sudo cp config/nginx/generated/kimiya-voice-development.conf /etc/nginx/sites-available/kimiya-voice
    sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/
    
    # Test and reload nginx
    if sudo nginx -t; then
        sudo systemctl reload nginx
        print_success "Development nginx configuration deployed successfully!"
        echo ""
        print_status "Access your application at:"
        echo "  • HTTP:  http://localhost:8080/builder"
        echo "  • HTTPS: https://localhost:8443/builder"
        echo "  • API calls will go to: http://localhost:3010/api/*"
    else
        print_error "Nginx configuration test failed!"
        exit 1
    fi
}

# Function to deploy production nginx configuration
deploy_production() {
    print_header "DEPLOYING PRODUCTION NGINX CONFIGURATION"
    
    print_status "This will configure nginx to:"
    echo "  • Serve frontend from: /var/www/kimiya-voice-devdist"
    echo "  • Proxy API calls to: http://localhost:3001 (production backend)"
    echo "  • HTTP access: http://localhost:8080 and https://ai-phone-call.kimiyi.ai"
    echo "  • HTTPS access: https://ai-phone-call.kimiyi.ai"
    echo ""
    
    # Check if production backend is running
    if ! pm2 list | grep -q "kimiya-voice-backend.*online"; then
        print_warning "Production backend is not running. Starting it now..."
        ./manage-environments.sh start-prod
    fi
    
    # Build production frontend
    print_status "Building production frontend..."
    cd /var/www/kimiya-voice
    npm run build
    
    # Deploy nginx configuration
    print_status "Deploying production nginx configuration..."
    sudo cp config/nginx/generated/kimiya-voice-production.conf /etc/nginx/sites-available/kimiya-voice
    sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/
    
    # Test and reload nginx
    if sudo nginx -t; then
        sudo systemctl reload nginx
        print_success "Production nginx configuration deployed successfully!"
        echo ""
        print_status "Access your application at:"
        echo "  • HTTP:  http://localhost:8080/builder"
        echo "  • HTTPS: https://ai-phone-call.kimiyi.ai/builder"
        echo "  • API calls will go to: http://localhost:3001/api/*"
    else
        print_error "Nginx configuration test failed!"
        exit 1
    fi
}

# Function to show current nginx configuration
show_current_config() {
    print_header "CURRENT NGINX CONFIGURATION"
    
    if [ -f "/etc/nginx/sites-enabled/kimiya-voice" ]; then
        # Check which backend port is configured
        backend_port=$(grep -o "proxy_pass http://localhost:[0-9]*" /etc/nginx/sites-enabled/kimiya-voice | head -1 | grep -o "[0-9]*$")
        
        # Check which frontend directory is configured
        frontend_dir=$(grep -o "root /var/www/[^;]*" /etc/nginx/sites-enabled/kimiya-voice | head -1 | cut -d' ' -f2)
        
        if [ "$backend_port" = "3010" ]; then
            echo "  🔧 Current Environment: DEVELOPMENT"
            echo "  📁 Frontend Directory: $frontend_dir"
            echo "  🔌 Backend Port: $backend_port (Development API)"
            echo "  🌐 Access URLs:"
            echo "     • http://localhost:8080/builder  (→ DEV frontend + DEV API)"
            echo "     • http://localhost:8081/builder  (→ DEV frontend + DEV API, VSCode forwarding)"
            echo "     • https://localhost:8443/builder (→ DEV frontend + DEV API, HTTPS)"
            echo "     • https://dev-ai-phone-call.kimiyi.ai/builder (→ DEV frontend + DEV API, External)"
            echo "  📊 API Routing: All /api/* calls → http://localhost:3010"
            echo "  🔗 Webhook Base URL: https://dev-ai-phone-call.kimiyi.ai"
        elif [ "$backend_port" = "3001" ]; then
            echo "  🏭 Current Environment: PRODUCTION"
            echo "  📁 Frontend Directory: $frontend_dir"
            echo "  🔌 Backend Port: $backend_port (Production API)"
            echo "  🌐 Access URLs:"
            echo "     • http://localhost:8080/builder        (→ PROD frontend + PROD API)"
            echo "     • https://ai-phone-call.kimiyi.ai/builder (→ PROD frontend + PROD API)"
            echo "  📊 API Routing: All /api/* calls → http://localhost:3001"
        else
            echo "  ❓ Unknown configuration detected"
            echo "  📁 Frontend Directory: $frontend_dir"
            echo "  🔌 Backend Port: $backend_port"
        fi
    else
        print_warning "No nginx configuration found for kimiya-voice"
    fi
}

# Main menu
show_menu() {
    print_header "KIMIYA VOICE NGINX ENVIRONMENT SWITCHER"
    echo "1. Show Current Configuration"
    echo "2. Deploy Development Configuration (Port 3010)"
    echo "3. Deploy Production Configuration (Port 3001)"
    echo "4. Exit"
    echo ""
    echo -n "Choose an option [1-4]: "
}

# Main script logic
case "${1:-menu}" in
    "dev"|"development")
        deploy_development
        ;;
    "prod"|"production")
        deploy_production
        ;;
    "status"|"show")
        show_current_config
        ;;
    "menu"|*)
        while true; do
            show_menu
            read -r choice
            case $choice in
                1) show_current_config ;;
                2) deploy_development ;;
                3) deploy_production ;;
                4) exit 0 ;;
                *) print_error "Invalid option. Please choose 1-4." ;;
            esac
            echo ""
            echo "Press Enter to continue..."
            read -r
        done
        ;;
esac
