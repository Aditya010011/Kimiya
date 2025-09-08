#!/bin/bash

# Install SSL Certificates for dev-ai-phone-call.kimiyi.ai
# This script installs the SSL certificate and private key for the development subdomain

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

print_header "INSTALL DEV SUBDOMAIN SSL CERTIFICATES"

print_status "This script will install SSL certificates for dev-ai-phone-call.kimiyi.ai"
echo "  • Certificate location: /etc/ssl/kimiya-ai/dev-ai-phone-call.crt"
echo "  • Private key location: /etc/ssl/kimiya-ai/dev-ai-phone-call.key"
echo "  • Updates nginx development configuration"
echo "  • Enables HTTPS access for external webhooks"
echo ""

# Check if certificate files are provided as arguments
if [ "$#" -eq 2 ]; then
    CERT_FILE="$1"
    KEY_FILE="$2"
    
    if [ ! -f "$CERT_FILE" ]; then
        print_error "Certificate file not found: $CERT_FILE"
        exit 1
    fi
    
    if [ ! -f "$KEY_FILE" ]; then
        print_error "Private key file not found: $KEY_FILE"
        exit 1
    fi
    
    print_status "Installing certificates from provided files..."
    sudo cp "$CERT_FILE" /etc/ssl/kimiya-ai/dev-ai-phone-call.crt
    sudo cp "$KEY_FILE" /etc/ssl/kimiya-ai/dev-ai-phone-call.key
    
else
    print_status "Please provide the SSL certificate and private key content."
    echo ""
    echo "Usage options:"
    echo "  1. Run with certificate files:"
    echo "     ./install-dev-ssl-certificates.sh /path/to/cert.crt /path/to/private.key"
    echo ""
    echo "  2. Or paste the certificate content when prompted:"
    echo ""
    
    # Create certificate file
    print_status "Please paste the SSL certificate content (PEM format):"
    print_warning "Paste the certificate including -----BEGIN CERTIFICATE----- and -----END CERTIFICATE-----"
    echo "Press Ctrl+D when finished:"
    
    sudo tee /etc/ssl/kimiya-ai/dev-ai-phone-call.crt > /dev/null
    
    echo ""
    print_status "Please paste the private key content (PEM format):"
    print_warning "Paste the private key including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----"
    echo "Press Ctrl+D when finished:"
    
    sudo tee /etc/ssl/kimiya-ai/dev-ai-phone-call.key > /dev/null
fi

# Set proper permissions
print_status "Setting proper permissions..."
sudo chmod 644 /etc/ssl/kimiya-ai/dev-ai-phone-call.crt
sudo chmod 600 /etc/ssl/kimiya-ai/dev-ai-phone-call.key
sudo chown root:root /etc/ssl/kimiya-ai/dev-ai-phone-call.*

# Verify certificates
print_status "Verifying certificates..."
if sudo openssl x509 -in /etc/ssl/kimiya-ai/dev-ai-phone-call.crt -text -noout > /dev/null 2>&1; then
    print_success "Certificate is valid"
else
    print_error "Certificate verification failed!"
    exit 1
fi

if sudo openssl rsa -in /etc/ssl/kimiya-ai/dev-ai-phone-call.key -check -noout > /dev/null 2>&1; then
    print_success "Private key is valid"
else
    print_error "Private key verification failed!"
    exit 1
fi

# Display certificate information
print_status "Certificate details:"
sudo openssl x509 -in /etc/ssl/kimiya-ai/dev-ai-phone-call.crt -text -noout | grep -E "(Subject:|Not After|DNS:|CN=)" || true

print_header "UPDATING NGINX CONFIGURATION"

# Update development nginx configuration to use new certificates
print_status "Updating development nginx configuration..."

# Update the development nginx config generator to use dev subdomain certificates
if [ -f "/var/www/kimiya-voice-devconfig/nginx/generate-nginx-config.sh" ]; then
    # Update the SSL certificate paths for development environment
    sudo sed -i 's|SSL_CERT_PATH="/etc/ssl/localhost/localhost.crt"|SSL_CERT_PATH="/etc/ssl/kimiya-ai/dev-ai-phone-call.crt"|g' /var/www/kimiya-voice-devconfig/nginx/generate-nginx-config.sh
    sudo sed -i 's|SSL_KEY_PATH="/etc/ssl/localhost/localhost.key"|SSL_KEY_PATH="/etc/ssl/kimiya-ai/dev-ai-phone-call.key"|g' /var/www/kimiya-voice-devconfig/nginx/generate-nginx-config.sh
    print_success "Updated nginx configuration generator"
fi

# Update existing development configuration
if [ -f "/var/www/kimiya-voice-devconfig/nginx/generated/kimiya-voice-development.conf" ]; then
    sudo sed -i 's|/etc/ssl/localhost/localhost.crt|/etc/ssl/kimiya-ai/dev-ai-phone-call.crt|g' /var/www/kimiya-voice-devconfig/nginx/generated/kimiya-voice-development.conf
    sudo sed -i 's|/etc/ssl/localhost/localhost.key|/etc/ssl/kimiya-ai/dev-ai-phone-call.key|g' /var/www/kimiya-voice-devconfig/nginx/generated/kimiya-voice-development.conf
    print_success "Updated development nginx configuration"
fi

print_header "ADDING DOMAIN SUPPORT"

# Add dev subdomain to development nginx configuration
print_status "Adding dev-ai-phone-call.kimiyi.ai to nginx configuration..."

# Update server_name in development config to include the subdomain
if [ -f "/var/www/kimiya-voice-devconfig/nginx/generated/kimiya-voice-development.conf" ]; then
    sudo sed -i 's|server_name localhost;|server_name localhost dev-ai-phone-call.kimiyi.ai;|g' /var/www/kimiya-voice-devconfig/nginx/generated/kimiya-voice-development.conf
    print_success "Added dev subdomain to nginx server_name"
fi

# Deploy the updated configuration
print_status "Deploying updated nginx configuration..."
sudo cp /var/www/kimiya-voice-devconfig/nginx/generated/kimiya-voice-development.conf /etc/nginx/sites-available/kimiya-voice

# Test nginx configuration
if sudo nginx -t; then
    print_success "Nginx configuration is valid"
    
    # Reload nginx
    print_status "Reloading nginx..."
    sudo systemctl reload nginx
    print_success "Nginx reloaded successfully"
else
    print_error "Nginx configuration test failed!"
    exit 1
fi

print_header "INSTALLATION COMPLETE"

print_success "SSL certificates installed and nginx configured!"
echo ""
print_status "Configuration summary:"
echo "  • Certificate: /etc/ssl/kimiya-ai/dev-ai-phone-call.crt"
echo "  • Private Key: /etc/ssl/kimiya-ai/dev-ai-phone-call.key"
echo "  • Domain: dev-ai-phone-call.kimiyi.ai"
echo "  • Backend Port: 3010"
echo "  • Webhook Base URL: https://dev-ai-phone-call.kimiyi.ai"
echo ""
print_status "Access URLs:"
echo "  • Development HTTPS: https://dev-ai-phone-call.kimiyi.ai/builder"
echo "  • Local development: http://localhost:8080/builder"
echo "  • VSCode forwarding: http://localhost:8081/builder"
echo ""
print_warning "Make sure DNS points dev-ai-phone-call.kimiyi.ai to your server IP!"
print_status "Test webhook access: curl https://dev-ai-phone-call.kimiyi.ai/health"

print_success "Development subdomain SSL setup complete! 🔒"
