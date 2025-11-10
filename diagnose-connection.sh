#!/bin/bash

# Connection Diagnostics Script for dev-ai-phone-call.kimiyi.ai

echo "🔍 Kimiya Voice Dev - Connection Diagnostics"
echo "=============================================="
echo ""

# Check DNS resolution
echo "📡 DNS Resolution:"
echo "  Domain: dev-ai-phone-call.kimiyi.ai"
DNS_IP=$(dig dev-ai-phone-call.kimiyi.ai +short | head -1)
echo "  Resolves to: $DNS_IP"
echo ""

# Check actual public IP
echo "🌐 Server's Actual Public IP:"
PUBLIC_IP=$(curl -s ifconfig.me)
echo "  $PUBLIC_IP"
echo ""

# Check if DNS is using Cloudflare proxy
if [[ "$DNS_IP" =~ ^(104\.21\.|172\.67\.|173\.245\.|103\.21\.|103\.22\.|103\.31\.|141\.101\.|108\.162\.|190\.93\.|188\.114\.|197\.234\.|198\.41\.|162\.158\.|104\.16\.|172\.64\.|131\.0\.|104\.17\.|104\.18\.|104\.19\.|104\.20\.|104\.21\.|104\.22\.|104\.23\.|104\.24\.|104\.25\.|104\.26\.|104\.27\.|104\.28\.|104\.29\.|104\.30\.|104\.31\.) ]]; then
    echo "✅ DNS is using Cloudflare proxy (Orange Cloud enabled)"
    echo "   Cloudflare IP: $DNS_IP"
    echo "   Your server IP: $PUBLIC_IP"
    echo "   This is the correct configuration!"
elif [ "$DNS_IP" == "$PUBLIC_IP" ]; then
    echo "✅ DNS points directly to server IP (Gray Cloud / DNS-only)"
    echo "   This works but Cloudflare proxy is disabled."
else
    echo "❌ DNS MISMATCH DETECTED!"
    echo "   DNS points to: $DNS_IP"
    echo "   Server is at:  $PUBLIC_IP"
    echo ""
    echo "🔧 FIX: Update your DNS A record for 'dev-ai-phone-call' to: $PUBLIC_IP"
fi
echo ""

# Check local services
echo "🔌 Local Services Status:"
echo "  Backend (port 3010):"
if curl -s http://localhost:3010/health > /dev/null 2>&1; then
    echo "    ✅ Running"
else
    echo "    ❌ Not responding"
fi

echo "  Frontend (port 3000):"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "    ✅ Running"
else
    echo "    ❌ Not responding"
fi

echo "  Nginx (port 443):"
if sudo netstat -tlnp | grep -q ":443.*nginx"; then
    echo "    ✅ Listening on port 443"
else
    echo "    ❌ Not listening on port 443"
fi
echo ""

# Check firewall
echo "🔥 Firewall Status:"
if sudo ufw status | grep -q "443.*ALLOW"; then
    echo "  ✅ Port 443 is allowed"
else
    echo "  ❌ Port 443 is blocked"
fi
echo ""

# Check PM2 processes
echo "📊 PM2 Processes:"
pm2 list | grep -E "kimiya-voice-(backend|frontend)-dev" | awk '{print "  " $2 ": " $10}'
echo ""

# Test external connectivity
echo "🌍 External Connectivity Test:"
echo "  Testing direct IP access (bypassing DNS)..."
if timeout 5 bash -c "curl -k -s -o /dev/null -w '%{http_code}' https://$PUBLIC_IP 2>/dev/null" | grep -q "200\|301\|302"; then
    echo "    ✅ External HTTPS access works"
    EXTERNAL_ACCESS=true
else
    echo "    ❌ Cannot connect to https://$PUBLIC_IP from outside"
    echo "       This indicates Azure NSG is blocking port 443"
    EXTERNAL_ACCESS=false
fi
echo ""

echo "=============================================="
echo "📋 Summary:"
echo ""

# Check for issues
ISSUES_FOUND=false

# Check if DNS is pointing to Cloudflare (which is correct)
if [[ "$DNS_IP" =~ ^(104\.21\.|172\.67\.|173\.245\.|103\.21\.|103\.22\.|103\.31\.|141\.101\.|108\.162\.|190\.93\.|188\.114\.|197\.234\.|198\.41\.|162\.158\.|104\.16\.|172\.64\.|131\.0\.) ]]; then
    # DNS is correctly using Cloudflare proxy - no issue
    :
elif [[ "$DNS_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && [ "$DNS_IP" != "$PUBLIC_IP" ]; then
    ISSUES_FOUND=true
    echo "⚠️  ISSUE 1: DNS Configuration Error"
    echo ""
    echo "Your domain dev-ai-phone-call.kimiyi.ai is pointing to the wrong IP."
    echo ""
    echo "Current DNS: $DNS_IP"
    echo "Should be:   $PUBLIC_IP (or use Cloudflare proxy)"
    echo ""
    echo "To fix this:"
    echo "1. Log into Cloudflare (or your DNS provider)"
    echo "2. Update the A record for 'dev-ai-phone-call' subdomain"
    echo "3. Change IP from $DNS_IP to $PUBLIC_IP"
    echo "4. OR enable Cloudflare proxy (Orange Cloud)"
    echo "5. Wait 5-10 minutes for DNS propagation"
    echo ""
fi

if [ "$EXTERNAL_ACCESS" = false ]; then
    ISSUES_FOUND=true
    echo "⚠️  ISSUE 2: Azure Network Security Group Blocking Traffic"
    echo ""
    echo "External connections to your server are being blocked."
    echo "This is the PRIMARY cause of the 522 error."
    echo ""
    echo "To fix this:"
    echo "1. Go to Azure Portal (https://portal.azure.com)"
    echo "2. Navigate to: Virtual Machines → Your VM → Networking"
    echo "3. Click 'Add inbound port rule'"
    echo "4. Add rules for ports: 80, 443, 8080"
    echo "   - Source: Any"
    echo "   - Destination port ranges: 443 (for HTTPS)"
    echo "   - Protocol: TCP"
    echo "   - Action: Allow"
    echo "   - Priority: 100"
    echo "5. Repeat for ports 80 and 8080"
    echo "6. Wait 1-2 minutes for rules to take effect"
    echo ""
fi

if [ "$ISSUES_FOUND" = false ]; then
    echo "✅ All checks passed! Your server should be accessible."
    echo ""
    echo "Test your site:"
    echo "  https://dev-ai-phone-call.kimiyi.ai"
fi

