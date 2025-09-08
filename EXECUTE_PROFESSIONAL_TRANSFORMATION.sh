#!/bin/bash

# Kimiya Voice Professional Transformation Script
# This script reorganizes the project into a professional development environment

set -e  # Exit on any error

echo "🚀 Kimiya Voice Professional Transformation"
echo "==========================================="

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
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

print_step "Starting professional transformation in: $PROJECT_DIR"

# Create backup before transformation
BACKUP_DIR="/tmp/kimiya-voice-backup-$(date +%Y%m%d_%H%M%S)"
print_step "Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR/"
print_status "Backup created successfully"

# Phase 1: Create new directory structure
print_step "Phase 1: Creating professional directory structure..."

# Create main directories
mkdir -p apps/{frontend,backend}
mkdir -p config/{environments,nginx,pm2}
mkdir -p deployment/{scripts,docker,systemd}
mkdir -p docs/{development,deployment,api}
mkdir -p tools/{scripts,monitoring,testing}
mkdir -p logs/{frontend,backend,nginx}
mkdir -p ssl/{development,staging,production}

print_status "Directory structure created"

# Phase 2: Move existing code to new structure
print_step "Phase 2: Moving existing code to new structure..."

# Move frontend code
if [ -d "src" ]; then
    mv src apps/frontend/
    print_status "Moved frontend source code"
fi

if [ -d "public" ]; then
    mv public apps/frontend/
    print_status "Moved frontend public assets"
fi

if [ -d "dist" ]; then
    mv dist apps/frontend/
    print_status "Moved frontend build output"
fi

# Move frontend config files
for file in package.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.ts postcss.config.js components.json eslint.config.js index.html; do
    if [ -f "$file" ]; then
        mv "$file" apps/frontend/
        print_status "Moved $file to frontend"
    fi
done

# Move backend code (preserve existing structure)
if [ -d "backend" ]; then
    # Move backend contents to new location
    mkdir -p apps/backend/src
    if [ -d "backend/routes" ]; then
        mv backend/routes apps/backend/src/
    fi
    if [ -d "backend/services" ]; then
        mv backend/services apps/backend/src/
    fi
    if [ -d "backend/utils" ]; then
        mv backend/utils apps/backend/src/
    fi
    
    # Move backend config files
    if [ -f "backend/server.js" ]; then
        mv backend/server.js apps/backend/
    fi
    if [ -f "backend/package.json" ]; then
        mv backend/package.json apps/backend/
    fi
    if [ -f "backend/package-lock.json" ]; then
        mv backend/package-lock.json apps/backend/
    fi
    
    # Move logs
    if [ -d "backend/logs" ]; then
        mv backend/logs/* logs/backend/ 2>/dev/null || true
    fi
    
    print_status "Moved backend code to new structure"
fi

# Phase 3: Create environment configurations
print_step "Phase 3: Creating environment configurations..."

# Create development environment
cat > config/environments/development.env << 'EOF'
# Development Environment Configuration
NODE_ENV=development
PORT=3001
FRONTEND_PORT=8080
LOG_LEVEL=debug

# Webhook Configuration
WEBHOOK_BASE_URL=http://localhost:3001

# Database Configuration (if needed)
# DATABASE_URL=postgresql://localhost:5432/kimiya_voice_dev

# External Services (use development/test credentials)
# TWILIO_ACCOUNT_SID=your_dev_twilio_sid
# TWILIO_AUTH_TOKEN=your_dev_twilio_token
# TWILIO_PHONE_NUMBER=your_dev_phone_number
# AZURE_OPENAI_API_KEY=your_dev_azure_key
# AZURE_OPENAI_ENDPOINT=your_dev_azure_endpoint
EOF

# Create staging environment
cat > config/environments/staging.env << 'EOF'
# Staging Environment Configuration
NODE_ENV=staging
PORT=3001
FRONTEND_PORT=8080
LOG_LEVEL=info

# Webhook Configuration
WEBHOOK_BASE_URL=https://staging.ai-phone-call.kimiyi.ai

# External Services (use staging credentials)
# TWILIO_ACCOUNT_SID=your_staging_twilio_sid
# TWILIO_AUTH_TOKEN=your_staging_twilio_token
# TWILIO_PHONE_NUMBER=your_staging_phone_number
# AZURE_OPENAI_API_KEY=your_staging_azure_key
# AZURE_OPENAI_ENDPOINT=your_staging_azure_endpoint
EOF

# Create production environment
cat > config/environments/production.env << 'EOF'
# Production Environment Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=warn

# Webhook Configuration
WEBHOOK_BASE_URL=https://ai-phone-call.kimiyi.ai

# External Services (use production credentials)
# TWILIO_ACCOUNT_SID=your_prod_twilio_sid
# TWILIO_AUTH_TOKEN=your_prod_twilio_token
# TWILIO_PHONE_NUMBER=your_prod_phone_number
# AZURE_OPENAI_API_KEY=your_prod_azure_key
# AZURE_OPENAI_ENDPOINT=your_prod_azure_endpoint
EOF

# Create environment template
cat > config/environments/.env.example << 'EOF'
# Environment Configuration Template
# Copy this file to the appropriate environment file and fill in your values

NODE_ENV=development
PORT=3001
FRONTEND_PORT=8080
LOG_LEVEL=debug

# Webhook Configuration
WEBHOOK_BASE_URL=http://localhost:3001

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint

# Optional: ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
EOF

print_status "Environment configurations created"

# Phase 4: Create PM2 configurations
print_step "Phase 4: Creating PM2 configurations..."

# Development PM2 config
cat > config/pm2/development.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kimiya-voice-backend-dev',
    script: './apps/backend/server.js',
    cwd: '/var/www/kimiya-voice-dev,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_file: './config/environments/development.env',
    error_file: './logs/backend/err.log',
    out_file: './logs/backend/out.log',
    log_file: './logs/backend/combined.log',
    time: true,
    watch: true,
    watch_delay: 1000,
    ignore_watch: ['node_modules', 'logs', 'dist'],
    max_memory_restart: '500M'
  }]
};
EOF

# Staging PM2 config
cat > config/pm2/staging.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kimiya-voice-backend-staging',
    script: './apps/backend/server.js',
    cwd: '/var/www/kimiya-voice-dev,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'staging',
      PORT: 3001
    },
    env_file: './config/environments/staging.env',
    error_file: './logs/backend/err.log',
    out_file: './logs/backend/out.log',
    log_file: './logs/backend/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# Production PM2 config
cat > config/pm2/production.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kimiya-voice-backend-prod',
    script: './apps/backend/server.js',
    cwd: '/var/www/kimiya-voice-dev,
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: './config/environments/production.env',
    error_file: './logs/backend/err.log',
    out_file: './logs/backend/out.log',
    log_file: './logs/backend/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

print_status "PM2 configurations created"

print_step "Phase 1 Complete: Basic structure transformation finished"
print_status "Backup location: $BACKUP_DIR"
print_warning "Next steps:"
echo "  1. Review the new structure"
echo "  2. Update environment configurations with your credentials"
echo "  3. Run: chmod +x deployment/scripts/*.sh"
echo "  4. Run: make setup-dev"
echo ""
print_status "Professional transformation Phase 1 completed successfully!"
