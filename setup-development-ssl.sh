#!/bin/bash

# Development SSL Certificate Setup for Kimiya Voice
# This script creates self-signed SSL certificates for localhost development

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

print_header "DEVELOPMENT SSL CERTIFICATE SETUP"

print_status "This script will create self-signed SSL certificates for localhost development"
echo "  • Certificate will be valid for: localhost, 127.0.0.1"
echo "  • Valid for: 365 days"
echo "  • Purpose: Development HTTPS on port 8443"
echo ""

# Check if certificates already exist
if [ -f "/etc/ssl/localhost/localhost.crt" ] && [ -f "/etc/ssl/localhost/localhost.key" ]; then
    print_warning "SSL certificates already exist!"
    echo ""
    echo "Existing certificate details:"
    sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -text -noout | grep -E "(Subject:|Not After|DNS:|IP Address)" || true
    echo ""
    
    read -p "Do you want to recreate the certificates? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Keeping existing certificates"
        exit 0
    fi
fi

# Create SSL directory
print_status "Creating SSL directory..."
sudo mkdir -p /etc/ssl/localhost

# Generate self-signed certificate
print_status "Generating self-signed SSL certificate for localhost..."
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/localhost/localhost.key \
  -out /etc/ssl/localhost/localhost.crt \
  -subj "/C=US/ST=Development/L=Development/O=Kimiya Voice Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1"

# Set proper permissions
print_status "Setting proper permissions..."
sudo chmod 644 /etc/ssl/localhost/localhost.crt
sudo chmod 600 /etc/ssl/localhost/localhost.key
sudo chown root:root /etc/ssl/localhost/localhost.*

# Verify certificate
print_status "Verifying certificate..."
if sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -text -noout > /dev/null 2>&1; then
    print_success "Certificate created and verified successfully!"
else
    print_error "Certificate verification failed!"
    exit 1
fi

# Display certificate information
echo ""
print_status "Certificate Details:"
sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -text -noout | grep -E "(Subject:|Not After|DNS:|IP Address)" || true

# Update nginx configuration if development environment is active
if [ -f "/etc/nginx/sites-enabled/kimiya-voice" ]; then
    if grep -q "3010" /etc/nginx/sites-enabled/kimiya-voice 2>/dev/null; then
        print_status "Development nginx configuration detected. Updating SSL paths..."
        
        # Check if already using localhost certificates
        if grep -q "/etc/ssl/localhost/" /etc/nginx/sites-enabled/kimiya-voice; then
            print_success "Nginx already configured to use localhost certificates"
        else
            print_status "Updating nginx configuration to use localhost certificates..."
            sudo sed -i 's|/etc/ssl/kimiya-ai/ai-phone-call.crt|/etc/ssl/localhost/localhost.crt|g' /etc/nginx/sites-enabled/kimiya-voice
            sudo sed -i 's|/etc/ssl/kimiya-ai/ai-phone-call.key|/etc/ssl/localhost/localhost.key|g' /etc/nginx/sites-enabled/kimiya-voice
            
            # Test and reload nginx
            if sudo nginx -t; then
                sudo systemctl reload nginx
                print_success "Nginx configuration updated and reloaded"
            else
                print_error "Nginx configuration test failed"
                exit 1
            fi
        fi
    fi
fi

print_header "SETUP COMPLETE"

print_success "Development SSL certificates are ready!"
echo ""
print_status "Next steps:"
echo "  1. Access your development site: https://localhost:8443/builder"
echo "  2. Your browser will show a security warning (this is normal for self-signed certificates)"
echo "  3. Click 'Advanced' → 'Proceed to localhost (unsafe)' to accept the certificate"
echo "  4. The certificate will be remembered for future visits"
echo ""
print_status "Certificate locations:"
echo "  • Certificate: /etc/ssl/localhost/localhost.crt"
echo "  • Private Key: /etc/ssl/localhost/localhost.key"
echo ""
print_warning "Note: This is a self-signed certificate for development only."
print_warning "For production, use proper SSL certificates from a trusted CA."
echo ""
print_status "To test HTTPS access:"
echo "  curl -k https://localhost:8443/health"
echo ""

# Test HTTPS if possible
if command -v curl &> /dev/null; then
    print_status "Testing HTTPS connection..."
    if curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/health | grep -q "200"; then
        print_success "HTTPS is working correctly! ✅"
    else
        print_warning "HTTPS test failed. Check nginx configuration."
    fi
fi

print_success "Development SSL setup completed successfully! 🔒"
