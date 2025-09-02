#!/bin/bash

# HTTPS Setup Script for Kimiya Voice
# This script sets up SSL certificates using Let's Encrypt

set -e

echo "🔒 Setting up HTTPS for Kimiya Voice..."

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your domain name"
    echo "Usage: ./setup-https.sh your-domain.com"
    echo ""
    echo "Examples:"
    echo "  ./setup-https.sh kimiya-voice.ddns.net"
    echo "  ./setup-https.sh kimiya-voice.hopto.org"
    echo "  ./setup-https.sh yourdomain.com"
    exit 1
fi

DOMAIN=$1
echo "🌐 Setting up HTTPS for domain: $DOMAIN"

# Update nginx config with the domain
echo "📝 Updating nginx configuration..."
sudo sed -i "s/server_name 20.255.99.49 kimiya-voice.duckdns.org;/server_name 20.255.99.49 $DOMAIN;/" /etc/nginx/sites-available/kimiya-voice

# Test nginx config
echo "🔍 Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

# Get SSL certificate
echo "🔒 Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Test SSL renewal
echo "🔄 Testing SSL certificate renewal..."
sudo certbot renew --dry-run

# Open HTTPS port in firewall
echo "🔥 Opening HTTPS port in firewall..."
sudo ufw allow 443/tcp

echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "✅ Your app is now available at:"
echo "   • https://$DOMAIN (HTTPS - Secure)"
echo "   • http://$DOMAIN (HTTP - Redirects to HTTPS)"
echo "   • http://20.255.99.49 (IP - Still works)"
echo ""
echo "🔒 SSL Certificate will auto-renew every 90 days"
echo "📊 Health check: https://$DOMAIN/health"
echo ""
echo "⚠️  Make sure your domain DNS points to: 20.255.99.49"
