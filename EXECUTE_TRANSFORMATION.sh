#!/bin/bash

# Kimiya Voice Professional Transformation Script
# This script performs the complete transformation from chaotic to professional setup

set -e  # Exit on any error

echo "🚀 Kimiya Voice Professional Transformation"
echo "==========================================="
echo ""
echo "⚠️  WARNING: This script will reorganize your entire project structure!"
echo "📋 Make sure you have backed up your project before proceeding."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Confirmation prompt
read -p "Do you want to proceed with the transformation? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Transformation cancelled."
    exit 0
fi

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

print_step "Starting transformation in: $PROJECT_DIR"

# Phase 1: Backup
print_step "Phase 1: Creating backup..."
BACKUP_DIR="/var/backups/kimiya-voice"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

sudo mkdir -p "$BACKUP_DIR"
sudo tar -czf "$BACKUP_DIR/kimiya-voice-pre-transformation-$TIMESTAMP.tar.gz" \
    --exclude=node_modules \
    --exclude=logs \
    --exclude=.git \
    .

print_status "Backup created: $BACKUP_DIR/kimiya-voice-pre-transformation-$TIMESTAMP.tar.gz"

# Phase 2: Stop services
print_step "Phase 2: Stopping services..."
sudo systemctl stop nginx 2>/dev/null || print_warning "nginx not running"
pm2 stop all 2>/dev/null || print_warning "No PM2 processes running"
pm2 delete all 2>/dev/null || print_warning "No PM2 processes to delete"

print_status "Services stopped"

# Phase 3: Create directory structure
print_step "Phase 3: Creating professional directory structure..."

mkdir -p apps/{frontend,backend}
mkdir -p config/{environments,nginx,pm2}
mkdir -p deployment/{scripts,docker,systemd}
mkdir -p docs/{development,deployment,api}
mkdir -p tools/{scripts,monitoring,testing}
mkdir -p logs/{frontend,backend,nginx}
mkdir -p ssl/{development,staging,production}

print_status "Directory structure created"