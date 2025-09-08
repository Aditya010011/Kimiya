#!/bin/bash

# Generate Nginx Configuration Script
# This script generates nginx configuration files using centralized port configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Get environment (default to production)
ENVIRONMENT=${1:-production}
DOMAIN_OVERRIDE=${2:-}
IP_ADDRESS=${3:-20.255.99.49}

print_status "Generating Nginx configuration for ${ENVIRONMENT} environment"
print_status "Domain: ${DOMAIN}"
print_status "IP Address: ${IP_ADDRESS}"

# Load port configuration
if [ ! -f "config/ports.cjs" ]; then
    print_error "Port configuration file not found: config/ports.cjs"
    exit 1
fi

# Extract ports using Node.js
BACKEND_PORT=$(node -e "
const { getPort } = require('./config/ports.cjs');
try {
    console.log(getPort('backend.api', '${ENVIRONMENT}'));
} catch (error) {
    console.log('3001'); // fallback
}
")

HTTP_PORT=$(node -e "
const { getPort } = require('./config/ports.cjs');
try {
    console.log(getPort('frontend.http', '${ENVIRONMENT}'));
} catch (error) {
    console.log('80'); // fallback
}
")

HTTPS_PORT=$(node -e "
const { getPort } = require('./config/ports.cjs');
try {
    console.log(getPort('frontend.https', '${ENVIRONMENT}'));
} catch (error) {
    console.log('443'); // fallback
}
")

ALT_HTTP_PORT=$(node -e "
const { getPort } = require('./config/ports.cjs');
try {
    console.log(getPort('frontend.alt_http', '${ENVIRONMENT}'));
} catch (error) {
    console.log('8080'); // fallback
}
")

# Set SSL certificate paths and domain based on environment
if [ "$ENVIRONMENT" = "development" ]; then
    SSL_CERT_PATH="/etc/ssl/kimiya-ai/dev-ai-phone-call.crt"
    SSL_KEY_PATH="/etc/ssl/kimiya-ai/dev-ai-phone-call.key"
    DOMAIN="${DOMAIN_OVERRIDE:-localhost dev-ai-phone-call.kimiyi.ai}"
else
    SSL_CERT_PATH="/etc/ssl/kimiya-ai/ai-phone-call.crt"
    SSL_KEY_PATH="/etc/ssl/kimiya-ai/ai-phone-call.key"
    DOMAIN="${DOMAIN_OVERRIDE:-ai-phone-call.kimiyi.ai}"
fi

print_status "Using ports: Backend=${BACKEND_PORT}, HTTP=${HTTP_PORT}, HTTPS=${HTTPS_PORT}, Alt HTTP=${ALT_HTTP_PORT}"
print_status "Using SSL: ${SSL_CERT_PATH}"

# Create nginx configuration directory
mkdir -p config/nginx/generated

# Generate main nginx configuration
cat > config/nginx/generated/kimiya-voice-${ENVIRONMENT}.conf << EOF
# Kimiya Voice - ${ENVIRONMENT^} Environment Nginx Configuration
# Generated automatically by generate-nginx-config.sh
# Backend Port: ${BACKEND_PORT} | HTTP: ${HTTP_PORT} | HTTPS: ${HTTPS_PORT} | Alt HTTP: ${ALT_HTTP_PORT}

# HTTPS server block for custom domain
server {
    listen ${HTTPS_PORT} ssl http2;
    server_name ${DOMAIN};
    
    # SSL configuration (customize paths as needed)
    ssl_certificate \${SSL_CERT_PATH};
    ssl_certificate_key \${SSL_KEY_PATH};
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Frontend - serve static files
    location / {
        root /var/www/kimiya-voice-devdist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API - proxy to Node.js server
    location /api/ {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoints
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /ping {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket support for ConversationRelay
    location /api/conversationrelay-ws {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Media streaming optimizations
        proxy_buffering off;
        proxy_cache off;
        proxy_request_buffering off;

        # WebSocket timeouts for media streaming
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;

        # Buffer sizes for audio streaming
        proxy_buffer_size 64k;
        proxy_buffers 8 64k;
        proxy_busy_buffers_size 128k;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
}

# HTTP server block for custom domain - redirect to HTTPS
server {
    listen ${HTTP_PORT};
    server_name ${DOMAIN};
    
    # Redirect to HTTPS
    return 301 https://\$host\$request_uri;
}

# HTTP server block for IP address access
server {
    listen ${HTTP_PORT};
    listen ${ALT_HTTP_PORT};
    server_name ${IP_ADDRESS};
    
    # Frontend - serve static files
    location / {
        root /var/www/kimiya-voice-devdist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API - proxy to Node.js server
    location /api/ {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoints
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /ping {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket support for ConversationRelay
    location /api/conversationrelay-ws {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
}
EOF

print_success "Generated nginx configuration: config/nginx/generated/kimiya-voice-${ENVIRONMENT}.conf"

# Generate deployment script
cat > config/nginx/deploy-nginx-${ENVIRONMENT}.sh << EOF
#!/bin/bash

# Deploy Nginx Configuration for ${ENVIRONMENT^} Environment
# This script deploys the generated nginx configuration

set -e

print_status() {
    echo -e "\033[0;34m[INFO]\033[0m \$1"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m \$1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m \$1"
}

print_status "Deploying nginx configuration for ${ENVIRONMENT} environment..."

# Check if configuration file exists
if [ ! -f "config/nginx/generated/kimiya-voice-${ENVIRONMENT}.conf" ]; then
    print_error "Configuration file not found. Run generate-nginx-config.sh first."
    exit 1
fi

# Copy configuration to nginx sites-available
sudo cp config/nginx/generated/kimiya-voice-${ENVIRONMENT}.conf /etc/nginx/sites-available/kimiya-voice

# Enable the site
sudo ln -sf /etc/nginx/sites-available/kimiya-voice /etc/nginx/sites-enabled/

# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
print_status "Testing nginx configuration..."
if sudo nginx -t; then
    print_success "Nginx configuration is valid"
    
    # Reload nginx
    print_status "Reloading nginx..."
    sudo systemctl reload nginx
    print_success "Nginx reloaded successfully"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

print_success "Nginx configuration deployed successfully for ${ENVIRONMENT} environment"
EOF

chmod +x config/nginx/deploy-nginx-${ENVIRONMENT}.sh

print_success "Generated deployment script: config/nginx/deploy-nginx-${ENVIRONMENT}.sh"
print_status "To deploy this configuration, run: ./config/nginx/deploy-nginx-${ENVIRONMENT}.sh"
