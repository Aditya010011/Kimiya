#!/bin/bash

# Kimiya Voice - Persistent Services Setup Script
# Sets up PM2 to manage both frontend and backend services persistently
# Ensures services auto-start on VM reboot and auto-restart on failure

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEV_DIR="/var/www/kimiya-voice-dev"
LOGS_DIR="$DEV_DIR/logs"

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

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Create logs directory
setup_logs() {
    print_status "Setting up logs directory..."
    mkdir -p "$LOGS_DIR"
    mkdir -p "$DEV_DIR/backend/logs"
    chmod 755 "$LOGS_DIR"
    chmod 755 "$DEV_DIR/backend/logs"
    print_success "Logs directory created"
}

# Check if PM2 is installed
check_pm2() {
    print_status "Checking PM2 installation..."
    if ! command -v pm2 &> /dev/null; then
        print_warning "PM2 not found. Installing globally..."
        npm install -g pm2
        print_success "PM2 installed"
    else
        print_success "PM2 is installed: $(pm2 --version)"
    fi
}

# Stop existing services
stop_existing_services() {
    print_status "Stopping existing services..."
    
    # Stop frontend if running
    if pm2 list | grep -q "kimiya-voice-frontend-dev"; then
        print_status "Stopping frontend service..."
        pm2 stop kimiya-voice-frontend-dev 2>/dev/null || true
        pm2 delete kimiya-voice-frontend-dev 2>/dev/null || true
    fi
    
    # Stop backend if running
    if pm2 list | grep -q "kimiya-voice-backend-dev"; then
        print_status "Stopping backend service..."
        pm2 stop kimiya-voice-backend-dev 2>/dev/null || true
        pm2 delete kimiya-voice-backend-dev 2>/dev/null || true
    fi
    
    sleep 2
    print_success "Existing services stopped"
}

# Start services with PM2
start_services() {
    print_header "STARTING SERVICES WITH PM2"
    
    cd "$DEV_DIR"
    
    print_status "Starting both frontend and backend services..."
    NODE_ENV=development pm2 start ecosystem-dev.config.cjs
    
    # Wait for services to start
    sleep 3
    
    # Check if services started successfully
    if pm2 list | grep -q "kimiya-voice-backend-dev.*online"; then
        print_success "Backend service started successfully"
    else
        print_error "Backend service failed to start"
        pm2 logs kimiya-voice-backend-dev --lines 20
        exit 1
    fi
    
    if pm2 list | grep -q "kimiya-voice-frontend-dev.*online"; then
        print_success "Frontend service started successfully"
    else
        print_error "Frontend service failed to start"
        pm2 logs kimiya-voice-frontend-dev --lines 20
        exit 1
    fi
}

# Save PM2 configuration for auto-start on reboot
setup_autostart() {
    print_header "SETTING UP AUTO-START ON REBOOT"
    
    print_status "Saving PM2 configuration..."
    pm2 save
    
    print_status "Setting up PM2 to start on system boot..."
    pm2 startup systemd -u azureuser --hp /home/azureuser
    
    print_success "PM2 auto-start configured"
    print_status "Services will automatically start when the VM reboots"
}

# Display service status
show_status() {
    print_header "SERVICE STATUS"
    pm2 list
    
    print_header "SERVICE DETAILS"
    print_status "Backend Service:"
    pm2 info kimiya-voice-backend-dev 2>/dev/null | head -20 || print_warning "Backend service not found"
    
    print_status ""
    print_status "Frontend Service:"
    pm2 info kimiya-voice-frontend-dev 2>/dev/null | head -20 || print_warning "Frontend service not found"
}

# Display access information
show_access_info() {
    print_header "ACCESS INFORMATION"
    
    print_success "✅ Services are now running persistently!"
    print_success ""
    print_success "🌐 Access URLs:"
    print_success "  • Development:  https://dev-ai-phone-call.kimiyi.ai/"
    print_success "  • Backend API:  http://localhost:3010"
    print_success "  • Frontend Dev: http://localhost:3000"
    print_success ""
    print_success "📊 Monitoring:"
    print_success "  • View all services:     pm2 list"
    print_success "  • View backend logs:     pm2 logs kimiya-voice-backend-dev"
    print_success "  • View frontend logs:    pm2 logs kimiya-voice-frontend-dev"
    print_success "  • View all logs:         pm2 logs"
    print_success "  • Real-time monitoring:  pm2 monit"
    print_success ""
    print_success "🔧 Management Commands:"
    print_success "  • Stop all services:     pm2 stop all"
    print_success "  • Start all services:    pm2 start all"
    print_success "  • Restart all services:  pm2 restart all"
    print_success "  • Stop backend:          pm2 stop kimiya-voice-backend-dev"
    print_success "  • Stop frontend:         pm2 stop kimiya-voice-frontend-dev"
    print_success "  • Restart backend:       pm2 restart kimiya-voice-backend-dev"
    print_success "  • Restart frontend:      pm2 restart kimiya-voice-frontend-dev"
    print_success ""
    print_success "📝 Logs Location:"
    print_success "  • Backend logs:  $DEV_DIR/backend/logs/"
    print_success "  • Frontend logs: $DEV_DIR/logs/"
    print_success ""
    print_success "🔄 Auto-Restart:"
    print_success "  • Services will auto-restart on failure"
    print_success "  • Services will auto-start on VM reboot"
}

# Main execution
main() {
    print_header "KIMIYA VOICE - PERSISTENT SERVICES SETUP"
    
    check_permissions
    setup_logs
    check_pm2
    stop_existing_services
    start_services
    setup_autostart
    show_status
    show_access_info
    
    print_header "SETUP COMPLETE ✅"
}

# Run main function
main

