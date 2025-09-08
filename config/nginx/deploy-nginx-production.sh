#!/bin/bash

# Deploy Nginx Configuration for Production Environment
# This script deploys the generated nginx configuration

set -e

print_status() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

print_status "Deploying nginx configuration for production environment..."

# Check if configuration file exists
if [ ! -f "config/nginx/generated/kimiya-voice-production.conf" ]; then
    print_error "Configuration file not found. Run generate-nginx-config.sh first."
    exit 1
fi

# Copy configuration to nginx sites-available
sudo cp config/nginx/generated/kimiya-voice-production.conf /etc/nginx/sites-available/kimiya-voice

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

print_success "Nginx configuration deployed successfully for production environment"
