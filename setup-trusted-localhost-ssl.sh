#!/bin/bash

# Advanced SSL Setup - Create Local CA and Trusted Certificate
# This creates a more browser-friendly certificate setup

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

print_header "ADVANCED LOCALHOST SSL SETUP WITH LOCAL CA"

print_status "This script creates a local Certificate Authority (CA) and issues a trusted certificate"
echo "  • Creates a local CA that you can install in your browser"
echo "  • Issues a certificate signed by this CA for localhost"
echo "  • Results in a more trusted certificate setup"
echo ""

# Create SSL directories
print_status "Creating SSL directory structure..."
sudo mkdir -p /etc/ssl/localhost-ca/{certs,private,csr}
sudo chmod 700 /etc/ssl/localhost-ca/private

# Create CA configuration
print_status "Creating CA configuration..."
sudo tee /etc/ssl/localhost-ca/ca.conf > /dev/null << 'EOF'
[req]
default_bits = 2048
prompt = no
distinguished_name = ca_distinguished_name
x509_extensions = ca_extensions

[ca_distinguished_name]
C = US
ST = Development
L = Development
O = Kimiya Voice Local CA
CN = Kimiya Voice Development CA

[ca_extensions]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer:always
EOF

# Create server certificate configuration
print_status "Creating server certificate configuration..."
sudo tee /etc/ssl/localhost-ca/server.conf > /dev/null << 'EOF'
[req]
default_bits = 2048
prompt = no
distinguished_name = server_distinguished_name
req_extensions = server_extensions

[server_distinguished_name]
C = US
ST = Development
L = Development
O = Kimiya Voice Dev
CN = localhost

[server_extensions]
basicConstraints = CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
EOF

# Generate CA private key
print_status "Generating CA private key..."
sudo openssl genrsa -out /etc/ssl/localhost-ca/private/ca.key 2048
sudo chmod 600 /etc/ssl/localhost-ca/private/ca.key

# Generate CA certificate
print_status "Generating CA certificate..."
sudo openssl req -new -x509 -days 3650 -key /etc/ssl/localhost-ca/private/ca.key \
    -out /etc/ssl/localhost-ca/certs/ca.crt \
    -config /etc/ssl/localhost-ca/ca.conf

# Generate server private key
print_status "Generating server private key..."
sudo openssl genrsa -out /etc/ssl/localhost-ca/private/localhost.key 2048
sudo chmod 600 /etc/ssl/localhost-ca/private/localhost.key

# Generate server certificate signing request
print_status "Generating server certificate signing request..."
sudo openssl req -new -key /etc/ssl/localhost-ca/private/localhost.key \
    -out /etc/ssl/localhost-ca/csr/localhost.csr \
    -config /etc/ssl/localhost-ca/server.conf

# Sign server certificate with CA
print_status "Signing server certificate with CA..."
sudo openssl x509 -req -days 365 \
    -in /etc/ssl/localhost-ca/csr/localhost.csr \
    -CA /etc/ssl/localhost-ca/certs/ca.crt \
    -CAkey /etc/ssl/localhost-ca/private/ca.key \
    -CAcreateserial \
    -out /etc/ssl/localhost-ca/certs/localhost.crt \
    -extensions server_extensions \
    -extfile /etc/ssl/localhost-ca/server.conf

# Copy certificates to standard locations
print_status "Installing certificates..."
sudo cp /etc/ssl/localhost-ca/certs/localhost.crt /etc/ssl/localhost/localhost.crt
sudo cp /etc/ssl/localhost-ca/private/localhost.key /etc/ssl/localhost/localhost.key
sudo chmod 644 /etc/ssl/localhost/localhost.crt
sudo chmod 600 /etc/ssl/localhost/localhost.key

# Copy CA certificate for browser installation
sudo cp /etc/ssl/localhost-ca/certs/ca.crt /tmp/kimiya-voice-ca.crt
sudo chmod 644 /tmp/kimiya-voice-ca.crt

# Update nginx configuration if needed
if [ -f "/etc/nginx/sites-enabled/kimiya-voice" ]; then
    if grep -q "3010" /etc/nginx/sites-enabled/kimiya-voice 2>/dev/null; then
        print_status "Reloading nginx with new certificate..."
        if sudo nginx -t; then
            sudo systemctl reload nginx
            print_success "Nginx reloaded successfully"
        else
            print_error "Nginx configuration test failed"
            exit 1
        fi
    fi
fi

print_header "INSTALLATION COMPLETE"

print_success "Advanced SSL setup completed!"
echo ""
print_status "What was created:"
echo "  • Local Certificate Authority (CA)"
echo "  • CA-signed certificate for localhost"
echo "  • More trusted certificate chain"
echo ""

print_header "BROWSER INSTALLATION INSTRUCTIONS"

print_warning "IMPORTANT: Install the CA certificate in your browser for full trust"
echo ""

echo -e "${BLUE}1. CHROME / EDGE${NC}"
echo "   a) Open Settings → Privacy and Security → Security → Manage certificates"
echo "   b) Go to 'Trusted Root Certification Authorities' tab"
echo "   c) Click 'Import...' and select: /tmp/kimiya-voice-ca.crt"
echo "   d) Restart browser"
echo ""

echo -e "${BLUE}2. FIREFOX${NC}"
echo "   a) Open Settings → Privacy & Security → Certificates → View Certificates"
echo "   b) Go to 'Authorities' tab"
echo "   c) Click 'Import...' and select: /tmp/kimiya-voice-ca.crt"
echo "   d) Check 'Trust this CA to identify websites'"
echo "   e) Restart browser"
echo ""

print_status "After installing the CA certificate:"
echo "  • Visit: https://localhost:8443/builder"
echo "  • You should see a green lock (fully trusted)"
echo "  • No security warnings"
echo ""

print_header "CERTIFICATE DETAILS"

print_status "CA Certificate:"
sudo openssl x509 -in /etc/ssl/localhost-ca/certs/ca.crt -text -noout | grep -E "(Subject:|Not After)" || true

print_status "Server Certificate:"
sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -text -noout | grep -E "(Subject:|Not After|DNS:|IP Address)" || true

echo ""
print_status "File locations:"
echo "  • CA Certificate (install in browser): /tmp/kimiya-voice-ca.crt"
echo "  • Server Certificate: /etc/ssl/localhost/localhost.crt"
echo "  • Server Private Key: /etc/ssl/localhost/localhost.key"
echo ""

# Test HTTPS connection
if command -v curl &> /dev/null; then
    print_status "Testing HTTPS connection..."
    if curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/health | grep -q "200"; then
        print_success "HTTPS server is responding correctly!"
    else
        print_warning "HTTPS server test failed. Check nginx configuration."
    fi
fi

print_success "Advanced SSL setup complete! Install the CA certificate in your browser for full trust. 🔒"
