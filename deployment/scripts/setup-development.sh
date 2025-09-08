#!/bin/bash

# Kimiya Voice Development Environment Setup Script
# This script sets up a complete development environment

set -e  # Exit on any error

echo "🚀 Kimiya Voice Development Environment Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

print_step "Setting up development environment in: $PROJECT_DIR"

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version: $(node --version) ✓"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

print_status "npm version: $(npm --version) ✓"

# Step 2: Create directory structure
print_step "Creating directory structure..."

mkdir -p apps/{frontend,backend}
mkdir -p config/{environments,nginx,pm2}
mkdir -p deployment/{scripts,docker,systemd}
mkdir -p docs/{development,deployment,api}
mkdir -p tools/{scripts,monitoring,testing}
mkdir -p logs/{frontend,backend,nginx}
mkdir -p ssl/{development,staging,production}

print_status "Directory structure created ✓"