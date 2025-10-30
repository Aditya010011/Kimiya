#!/bin/bash

# Kimiya Voice - Service Management Script
# Provides easy commands to manage frontend and backend services

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

show_help() {
    print_header "KIMIYA VOICE - SERVICE MANAGEMENT"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  status              Show status of all services"
    echo "  start               Start all services"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  logs                Show logs from all services"
    echo "  logs-backend        Show backend logs only"
    echo "  logs-frontend       Show frontend logs only"
    echo "  monit               Real-time monitoring (press 'q' to exit)"
    echo "  start-backend       Start backend service only"
    echo "  start-frontend      Start frontend service only"
    echo "  stop-backend        Stop backend service only"
    echo "  stop-frontend       Stop frontend service only"
    echo "  restart-backend     Restart backend service only"
    echo "  restart-frontend    Restart frontend service only"
    echo "  info-backend        Show detailed backend info"
    echo "  info-frontend       Show detailed frontend info"
    echo "  save                Save PM2 configuration"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status           # Check if services are running"
    echo "  $0 logs             # View all service logs"
    echo "  $0 restart-backend  # Restart only the backend"
    echo "  $0 monit            # Monitor services in real-time"
    echo ""
}

check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 is not installed. Please run setup-persistent-services.sh first"
        exit 1
    fi
}

cmd_status() {
    print_header "SERVICE STATUS"
    pm2 list
    echo ""
    
    # Check if services are running
    if pm2 list | grep -q "kimiya-voice-backend-dev.*online"; then
        print_success "✅ Backend service is RUNNING"
    else
        print_warning "⚠️  Backend service is NOT running"
    fi
    
    if pm2 list | grep -q "kimiya-voice-frontend-dev.*online"; then
        print_success "✅ Frontend service is RUNNING"
    else
        print_warning "⚠️  Frontend service is NOT running"
    fi
}

cmd_start() {
    print_status "Starting all services..."
    pm2 start all
    sleep 2
    cmd_status
}

cmd_stop() {
    print_status "Stopping all services..."
    pm2 stop all
    print_success "All services stopped"
}

cmd_restart() {
    print_status "Restarting all services..."
    pm2 restart all
    sleep 2
    cmd_status
}

cmd_logs() {
    print_header "SERVICE LOGS (Press Ctrl+C to exit)"
    pm2 logs
}

cmd_logs_backend() {
    print_header "BACKEND SERVICE LOGS (Press Ctrl+C to exit)"
    pm2 logs kimiya-voice-backend-dev
}

cmd_logs_frontend() {
    print_header "FRONTEND SERVICE LOGS (Press Ctrl+C to exit)"
    pm2 logs kimiya-voice-frontend-dev
}

cmd_monit() {
    print_header "REAL-TIME MONITORING (Press 'q' to exit)"
    pm2 monit
}

cmd_start_backend() {
    print_status "Starting backend service..."
    pm2 start kimiya-voice-backend-dev
    sleep 2
    print_success "Backend service started"
    pm2 info kimiya-voice-backend-dev | head -15
}

cmd_start_frontend() {
    print_status "Starting frontend service..."
    pm2 start kimiya-voice-frontend-dev
    sleep 2
    print_success "Frontend service started"
    pm2 info kimiya-voice-frontend-dev | head -15
}

cmd_stop_backend() {
    print_status "Stopping backend service..."
    pm2 stop kimiya-voice-backend-dev
    print_success "Backend service stopped"
}

cmd_stop_frontend() {
    print_status "Stopping frontend service..."
    pm2 stop kimiya-voice-frontend-dev
    print_success "Frontend service stopped"
}

cmd_restart_backend() {
    print_status "Restarting backend service..."
    pm2 restart kimiya-voice-backend-dev
    sleep 2
    print_success "Backend service restarted"
    pm2 info kimiya-voice-backend-dev | head -15
}

cmd_restart_frontend() {
    print_status "Restarting frontend service..."
    pm2 restart kimiya-voice-frontend-dev
    sleep 2
    print_success "Frontend service restarted"
    pm2 info kimiya-voice-frontend-dev | head -15
}

cmd_info_backend() {
    print_header "BACKEND SERVICE DETAILS"
    pm2 info kimiya-voice-backend-dev
}

cmd_info_frontend() {
    print_header "FRONTEND SERVICE DETAILS"
    pm2 info kimiya-voice-frontend-dev
}

cmd_save() {
    print_status "Saving PM2 configuration..."
    pm2 save
    print_success "PM2 configuration saved"
}

# Main execution
check_pm2

case "${1:-help}" in
    status)
        cmd_status
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs
        ;;
    logs-backend)
        cmd_logs_backend
        ;;
    logs-frontend)
        cmd_logs_frontend
        ;;
    monit)
        cmd_monit
        ;;
    start-backend)
        cmd_start_backend
        ;;
    start-frontend)
        cmd_start_frontend
        ;;
    stop-backend)
        cmd_stop_backend
        ;;
    stop-frontend)
        cmd_stop_frontend
        ;;
    restart-backend)
        cmd_restart_backend
        ;;
    restart-frontend)
        cmd_restart_frontend
        ;;
    info-backend)
        cmd_info_backend
        ;;
    info-frontend)
        cmd_info_frontend
        ;;
    save)
        cmd_save
        ;;
    help)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

