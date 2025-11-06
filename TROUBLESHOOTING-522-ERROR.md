# Troubleshooting 522 Error for dev-ai-phone-call2.kimiyi.ai

## Current Status

### ✅ What's Working:
- DNS is correctly configured with Cloudflare proxy (Orange Cloud enabled)
- SSL certificates are valid (Let's Encrypt, expires Dec 14, 2025)
- Backend server running on port 3010 ✅
- Frontend Vite server running on port 3000 ✅
- Nginx is running and listening on port 443 ✅
- UFW firewall allows ports 80, 443, 8080 ✅

### ❌ What's NOT Working:
1. **Azure Network Security Group (NSG) is blocking external traffic** - PRIMARY ISSUE
2. **Nginx configuration mismatch** - pointing to wrong ports

---

## Issue #1: Azure NSG Blocking Traffic (CRITICAL)

### Problem:
External connections to your server are being blocked by Azure NSG, causing 522 timeouts.

### Test:
```bash
curl -k -I https://172.188.82.149
# Result: Connection timeout
```

### Solution:
You MUST add inbound security rules in Azure to allow traffic on ports 80, 443, and 8080.

#### Steps to Fix in Azure Portal:

1. Go to https://portal.azure.com
2. Navigate to: **Virtual Machines** → **Your VM**
3. Click **Networking** in the left sidebar
4. Click **Add inbound port rule**
5. Add the following rules:

**Rule 1 - HTTPS (Port 443):**
```
Source: Any
Source port ranges: *
Destination: Any
Service: HTTPS
Destination port ranges: 443
Protocol: TCP
Action: Allow
Priority: 100
Name: Allow-HTTPS-Inbound
```

**Rule 2 - HTTP (Port 80):**
```
Source: Any
Source port ranges: *
Destination: Any
Service: HTTP
Destination port ranges: 80
Protocol: TCP
Action: Allow
Priority: 110
Name: Allow-HTTP-Inbound
```

**Rule 3 - HTTP-Alt (Port 8080):**
```
Source: Any
Source port ranges: *
Destination: Any
Service: Custom
Destination port ranges: 8080
Protocol: TCP
Action: Allow
Priority: 120
Name: Allow-HTTP-Alt-Inbound
```

6. Click **Add** for each rule
7. **Wait 1-2 minutes** for rules to take effect

---

## Issue #2: Nginx Configuration Mismatch

### Problem:
The nginx config for `dev-ai-phone-call2.kimiyi.ai` is pointing to:
- Frontend: port 3020 (doesn't exist)
- Backend: port 5000 (doesn't exist)

But your actual services are running on:
- Frontend: port 3000 ✅
- Backend: port 3010 ✅

### Current Config Location:
`/etc/nginx/sites-available/kimiyi-voice2.conf`

### Solution Options:

#### Option A: Update kimiyi-voice2.conf (Recommended)
Edit `/etc/nginx/sites-available/kimiyi-voice2.conf` and change:
- Line with `proxy_pass http://127.0.0.1:3020;` → `proxy_pass http://127.0.0.1:3000;`
- Line with `proxy_pass http://localhost:5000;` → `proxy_pass http://localhost:3010;`

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Disable kimiyi-voice2.conf and use kimiya-voice-dev config
```bash
sudo rm /etc/nginx/sites-enabled/kimiyi-voice2.conf
sudo ln -s /etc/nginx/sites-available/kimiya-voice-dev /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Verification Steps

After fixing both issues, run these tests:

### 1. Test Direct IP Access (bypassing Cloudflare):
```bash
curl -k -I https://172.188.82.149
```
Expected: HTTP/2 200 or 301

### 2. Test Domain Access (through Cloudflare):
```bash
curl -I https://dev-ai-phone-call2.kimiyi.ai
```
Expected: HTTP/2 200

### 3. Run Diagnostic Script:
```bash
cd /var/www/kimiya-voice-dev
./diagnose-connection.sh
```
Expected: "✅ All checks passed!"

### 4. Test in Browser:
Open: https://dev-ai-phone-call2.kimiyi.ai
Expected: Your application loads without 522 error

---

## Quick Fix Commands

If you want to quickly fix the nginx config issue:

```bash
# Backup current config
sudo cp /etc/nginx/sites-available/kimiyi-voice2.conf /etc/nginx/sites-available/kimiyi-voice2.conf.backup

# Update the config (replace port 3020 with 3000, and 5000 with 3010)
sudo sed -i 's/proxy_pass http:\/\/127.0.0.1:3020;/proxy_pass http:\/\/127.0.0.1:3000;/g' /etc/nginx/sites-available/kimiyi-voice2.conf
sudo sed -i 's/proxy_pass http:\/\/localhost:5000;/proxy_pass http:\/\/localhost:3010;/g' /etc/nginx/sites-available/kimiyi-voice2.conf

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Summary

**To fix the 522 error, you need to do BOTH:**

1. ✅ **Add Azure NSG inbound rules** for ports 80, 443, 8080 (CRITICAL)
2. ✅ **Fix nginx config** to point to correct ports (3000, 3010)

The Azure NSG issue is the PRIMARY cause of the 522 error. Even if nginx is configured correctly, Cloudflare cannot reach your server if Azure is blocking the traffic.

---

## Additional Notes

- **Domain**: dev-ai-phone-call2.kimiyi.ai
- **DNS Configuration**: ✅ Correct (using Cloudflare proxy)
- **SSL Certificates**: ✅ Valid until Dec 14, 2025
- **Cloudflare SSL/TLS Mode**: Should be set to "Full" or "Full (strict)"
- **Server IP**: 172.188.82.149
- **Cloudflare IPs**: 104.21.18.94, 172.67.181.138
- **Backend Port**: 3010
- **Frontend Port**: 3000

---

## Need Help?

Run the diagnostic script anytime to check status:
```bash
cd /var/www/kimiya-voice-dev && ./diagnose-connection.sh
```

