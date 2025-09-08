#!/bin/bash

# Install Localhost Certificate in Browser Trust Store
# This script helps install the self-signed localhost certificate so browsers trust it

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

print_header "INSTALL LOCALHOST SSL CERTIFICATE IN BROWSER"

print_status "This script will help you install the localhost certificate in your browser's trust store"
echo "  • This will make https://localhost:8443 show as fully secure"
echo "  • The certificate will be trusted without warnings"
echo "  • This only affects your local development environment"
echo ""

# Check if certificate exists
if [ ! -f "/etc/ssl/localhost/localhost.crt" ]; then
    print_error "Localhost certificate not found!"
    print_status "Run ./setup-development-ssl.sh first to create the certificate"
    exit 1
fi

# Copy certificate to accessible location
print_status "Preparing certificate for installation..."
sudo cp /etc/ssl/localhost/localhost.crt /tmp/localhost.crt
sudo chmod 644 /tmp/localhost.crt

print_success "Certificate prepared: /tmp/localhost.crt"

print_header "BROWSER INSTALLATION INSTRUCTIONS"

echo -e "${YELLOW}Choose your browser and follow the instructions:${NC}"
echo ""

echo -e "${BLUE}1. CHROME / EDGE (Recommended)${NC}"
echo "   a) Open Chrome/Edge settings"
echo "   b) Search for 'certificates' or go to Privacy and Security → Security → Manage certificates"
echo "   c) Go to 'Trusted Root Certification Authorities' tab"
echo "   d) Click 'Import...' and select: /tmp/localhost.crt"
echo "   e) Restart browser and visit https://localhost:8443"
echo ""

echo -e "${BLUE}2. FIREFOX${NC}"
echo "   a) Open Firefox settings"
echo "   b) Search for 'certificates' or go to Privacy & Security → Certificates → View Certificates"
echo "   c) Go to 'Authorities' tab"
echo "   d) Click 'Import...' and select: /tmp/localhost.crt"
echo "   e) Check 'Trust this CA to identify websites'"
echo "   f) Restart browser and visit https://localhost:8443"
echo ""

echo -e "${BLUE}3. SAFARI (macOS)${NC}"
echo "   a) Double-click /tmp/localhost.crt to open Keychain Access"
echo "   b) Find 'localhost' certificate in System keychain"
echo "   c) Double-click it and expand 'Trust'"
echo "   d) Set 'When using this certificate' to 'Always Trust'"
echo "   e) Restart browser and visit https://localhost:8443"
echo ""

print_header "ALTERNATIVE SOLUTIONS"

echo -e "${YELLOW}If you prefer not to install the certificate:${NC}"
echo ""

echo -e "${BLUE}Option A: Use HTTP instead (No SSL warnings)${NC}"
echo "   • http://localhost:8080/builder"
echo "   • http://localhost:8081/builder (VSCode port forwarding)"
echo ""

echo -e "${BLUE}Option B: Accept the warning each time${NC}"
echo "   • Visit https://localhost:8443/builder"
echo "   • Click 'Advanced' → 'Proceed to localhost (unsafe)'"
echo "   • Browser will remember for the session"
echo ""

echo -e "${BLUE}Option C: Use production HTTPS (Fully trusted)${NC}"
echo "   • Switch to production: ./switch-nginx-environment.sh prod"
echo "   • Visit https://ai-phone-call.kimiyi.ai/builder"
echo ""

print_header "VERIFICATION"

print_status "After installing the certificate, verify it works:"
echo "  1. Restart your browser completely"
echo "  2. Visit: https://localhost:8443/builder"
echo "  3. You should see a green lock icon (secure)"
echo "  4. Certificate details should show 'This certificate is OK'"
echo ""

print_status "Test HTTPS connection:"
echo "  curl -s https://localhost:8443/health"
echo ""

# Test current connection
if command -v curl &> /dev/null; then
    print_status "Testing current HTTPS connection..."
    if curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/health | grep -q "200"; then
        print_success "HTTPS server is responding correctly (ignoring certificate validation)"
    else
        print_warning "HTTPS server test failed. Check nginx configuration."
    fi
fi

print_header "CERTIFICATE DETAILS"

print_status "Your localhost certificate details:"
sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -text -noout | grep -E "(Subject:|Not After|DNS:|IP Address)" || true

echo ""
print_status "Certificate file locations:"
echo "  • Certificate: /etc/ssl/localhost/localhost.crt"
echo "  • Private Key: /etc/ssl/localhost/localhost.key"
echo "  • Temporary copy: /tmp/localhost.crt (for browser import)"
echo ""

print_warning "Note: This certificate is only valid for localhost development."
print_warning "It will not work for other domains or IP addresses."

print_success "Certificate installation guide complete!"
echo ""
print_status "Need help? Check docs/SSL_CERTIFICATE_GUIDE.md for more details."
