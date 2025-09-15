#!/bin/bash

# Kimiya Voice Environment Management Script
# This script helps manage production and development environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Directories
PROD_DIR="/var/www/kimiya-voice"
DEV_DIR="/var/www/kimiya-voice-dev"

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

# Function to check if directory exists
check_directory() {
    if [ ! -d "$1" ]; then
        print_error "Directory not found: $1"
        return 1
    fi
    return 0
}

# Function to show environment status
show_status() {
    print_header "ENVIRONMENT STATUS"
    
    echo -e "${BLUE}Production Environment:${NC}"
    if check_directory "$PROD_DIR"; then
        echo "  📁 Directory: $PROD_DIR ✅"
        
        # Check PM2 processes
        if pm2 list | grep -q "kimiya-voice-backend"; then
            echo "  🔄 PM2 Process: Running ✅"
        else
            echo "  🔄 PM2 Process: Stopped ❌"
        fi
        
        # Check nginx
        if sudo nginx -t &>/dev/null && systemctl is-active --quiet nginx; then
            echo "  🌐 Nginx: Running ✅"
        else
            echo "  🌐 Nginx: Issues ❌"
        fi
    fi
    
    echo ""
    echo -e "${BLUE}Development Environment:${NC}"
    if check_directory "$DEV_DIR"; then
        echo "  📁 Directory: $DEV_DIR ✅"
        
        # Check PM2 processes
        if pm2 list | grep -q "kimiya-voice-backend-dev"; then
            echo "  🔄 PM2 Process: Running ✅"
        else
            echo "  🔄 PM2 Process: Stopped ❌"
        fi
    else
        echo "  📁 Directory: Not found ❌"
    fi
    
    echo ""
    echo -e "${BLUE}Port Usage:${NC}"
    echo "  Production Backend: 3001"
    echo "  Development Backend: 3010"
    echo "  Development Frontend: 3000 (Vite dev server)"
    echo "  Development HTTP: 8080"
    echo "  Development HTTPS: 8443"
}

# Function to start production environment
start_production() {
    print_header "STARTING PRODUCTION ENVIRONMENT"
    
    if ! check_directory "$PROD_DIR"; then
        return 1
    fi
    
    cd "$PROD_DIR"
    
    print_status "Starting production backend with PM2..."
    NODE_ENV=production pm2 start config/pm2/production.config.cjs
    
    print_status "Configuring nginx for production..."
    if [ -f "config/nginx/generated/kimiya-voice-production.conf" ]; then
        sudo cp config/nginx/generated/kimiya-voice-production.conf /etc/nginx/sites-available/kimiya-voice
        sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx
    else
        print_warning "Production nginx config not found. Generate it first."
    fi
    
    pm2 save
    print_success "Production environment started"
}

# Function to start development environment
start_development() {
    print_header "STARTING DEVELOPMENT ENVIRONMENT"
    
    if ! check_directory "$DEV_DIR"; then
        return 1
    fi
    
    cd "$DEV_DIR"
    
    print_status "Installing/updating dependencies..."
    npm install
    cd backend && npm install && cd ..
    
    print_status "Starting development backend with PM2..."
    NODE_ENV=development pm2 start config/pm2/development.config.cjs
    
    print_success "Development backend started on port 3010"
    print_status "To start frontend dev server, run: cd $DEV_DIR && npm run dev"
}

# Function to stop environments
stop_production() {
    print_header "STOPPING PRODUCTION ENVIRONMENT"
    pm2 delete kimiya-voice-backend 2>/dev/null || print_warning "Production process not found"
    print_success "Production environment stopped"
}

stop_development() {
    print_header "STOPPING DEVELOPMENT ENVIRONMENT"
    pm2 delete kimiya-voice-backend-dev 2>/dev/null || print_warning "Development process not found"
    print_success "Development environment stopped"
}

# Function to deploy from dev to production
deploy_to_production() {
    print_header "DEPLOYING FROM DEVELOPMENT TO PRODUCTION"
    
    if ! check_directory "$DEV_DIR" || ! check_directory "$PROD_DIR"; then
        return 1
    fi
    
    print_warning "This will overwrite production files. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled"
        return 0
    fi
    
    print_status "Stopping production environment..."
    stop_production
    
    print_status "Backing up production environment..."
    sudo cp -r "$PROD_DIR" "${PROD_DIR}-backup-$(date +%Y%m%d-%H%M%S)"
    
    print_status "Copying development files to production..."
    # Copy source files but preserve production configs
    sudo rsync -av --exclude='node_modules' --exclude='backend/node_modules' \
        --exclude='dist' --exclude='backend/logs' --exclude='.env*' \
        "$DEV_DIR/" "$PROD_DIR/"
    
    cd "$PROD_DIR"
    
    print_status "Installing production dependencies..."
    npm install --production
    cd backend && npm install --production && cd ..
    
    print_status "Building production assets..."
    npm run build
    
    print_status "Starting production environment..."
    start_production
    
    print_success "Deployment completed successfully"
}

# Main menu
show_menu() {
    print_header "KIMIYA VOICE ENVIRONMENT MANAGER"
    echo "1. Show Status"
    echo "2. Start Production"
    echo "3. Start Development"
    echo "4. Stop Production"
    echo "5. Stop Development"
    echo "6. Deploy Dev to Production"
    echo "7. Exit"
    echo ""
    echo -n "Choose an option [1-7]: "
}

# Main script logic
case "${1:-menu}" in
    "status")
        show_status
        ;;
    "start-prod")
        start_production
        ;;
    "start-dev")
        start_development
        ;;
    "stop-prod")
        stop_production
        ;;
    "stop-dev")
        stop_development
        ;;
    "deploy")
        deploy_to_production
        ;;
    "menu"|*)
        while true; do
            show_menu
            read -r choice
            case $choice in
                1) show_status ;;
                2) start_production ;;
                3) start_development ;;
                4) stop_production ;;
                5) stop_development ;;
                6) deploy_to_production ;;
                7) exit 0 ;;
                *) print_error "Invalid option. Please choose 1-7." ;;
            esac
            echo ""
            echo "Press Enter to continue..."
            read -r
        done
        ;;
esac
