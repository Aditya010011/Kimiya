# Domain Update Summary: dev-ai-phone-call → dev-ai-phone-call2

## ✅ Changes Completed

### 1. **Environment Variables Updated**

#### Backend Environment (`backend/.env.development`):
- ✅ `WEBHOOK_BASE_URL`: `https://dev-ai-phone-call.kimiyi.ai` → `https://dev-ai-phone-call2.kimiyi.ai`
- ✅ `STRIPE_WEBHOOK_URL`: `https://dev-ai-phone-call.kimiyi.ai/api/stripe/webhook` → `https://dev-ai-phone-call2.kimiyi.ai/api/stripe/webhook`

#### Frontend Environment (`.env.development`):
- ✅ `VITE_BACKEND_URL`: `https://dev-ai-phone-call.kimiyi.ai` → `https://dev-ai-phone-call2.kimiyi.ai`

### 2. **Nginx Configuration Updated**

#### File: `/etc/nginx/sites-available/kimiyi-voice2.conf`
- ✅ `server_name`: `dev-ai-phone-call2.kimiyi.ai` (already configured)
- ✅ SSL certificates: Using Let's Encrypt certificates for `dev-ai-phone-call2.kimiyi.ai`
- ✅ Frontend proxy: `http://127.0.0.1:3000` (port 3000) ✅
- ✅ Backend API proxy: `http://localhost:3010` (port 3010) ✅
- ✅ Nginx reloaded successfully

### 3. **SSL Certificates**

- ✅ Let's Encrypt certificates exist for `dev-ai-phone-call2.kimiyi.ai`
- ✅ Valid until: **December 14, 2025**
- ✅ Certificate paths:
  - `/etc/letsencrypt/live/dev-ai-phone-call2.kimiyi.ai/fullchain.pem`
  - `/etc/letsencrypt/live/dev-ai-phone-call2.kimiyi.ai/privkey.pem`

### 4. **PM2 Services Restarted**

- ✅ `kimiya-voice-backend-dev` (port 3010) - Restarted
- ✅ `kimiya-voice-frontend-dev` (port 3000) - Restarted

### 5. **Diagnostic Script Updated**

- ✅ `diagnose-connection.sh` now checks `dev-ai-phone-call2.kimiyi.ai`
- ✅ Cloudflare proxy detection added
- ✅ DNS resolution updated

---

## 🔍 Verification

### Backend Health Check:
```bash
curl -s http://localhost:3010/health | jq '.conversationRelay.expectedUrl, .environment.webhookBaseUrl'
```

**Result:**
```json
"wss://dev-ai-phone-call2.kimiyi.ai/api/conversationrelay-ws"
"https://dev-ai-phone-call2.kimiyi.ai"
```
✅ Backend is using the new domain!

### Local HTTPS Test:
```bash
curl -k -I https://localhost
```
**Result:** HTTP/2 200 ✅

---

## 📋 Port Configuration

| Service | Port | Status |
|---------|------|--------|
| Backend API | 3010 | ✅ Running |
| Frontend Vite | 3000 | ✅ Running |
| Nginx HTTPS | 443 | ✅ Listening |
| Nginx HTTP | 80 | ✅ Listening (redirects to HTTPS) |

---

## 🌐 DNS Configuration

- **Domain**: `dev-ai-phone-call2.kimiyi.ai`
- **DNS Provider**: Cloudflare
- **Cloudflare Proxy**: ✅ Enabled (Orange Cloud)
- **Cloudflare IPs**: 104.21.18.94, 172.67.181.138
- **Server IP**: 172.188.82.149

---

## ⚠️ REMAINING ISSUE: Azure NSG

**The ONLY remaining issue is Azure Network Security Group (NSG) blocking external traffic.**

### Why the site still shows 522 error:

Even though everything is configured correctly:
- ✅ DNS points to Cloudflare
- ✅ SSL certificates are valid
- ✅ Nginx is configured correctly
- ✅ Backend and frontend are running
- ✅ Local HTTPS works perfectly

**Azure NSG is blocking Cloudflare from connecting to your server on ports 80, 443, and 8080.**

### To Fix:

1. Go to https://portal.azure.com
2. Navigate to: **Virtual Machines** → **Your VM** → **Networking**
3. Click **"Add inbound port rule"**
4. Add these 3 rules:

   **HTTPS (Port 443):**
   - Source: `Any`
   - Destination port ranges: `443`
   - Protocol: `TCP`
   - Action: `Allow`
   - Priority: `100`

   **HTTP (Port 80):**
   - Source: `Any`
   - Destination port ranges: `80`
   - Protocol: `TCP`
   - Action: `Allow`
   - Priority: `110`

   **HTTP-Alt (Port 8080):**
   - Source: `Any`
   - Destination port ranges: `8080`
   - Protocol: `TCP`
   - Action: `Allow`
   - Priority: `120`

5. Wait 1-2 minutes for rules to take effect

---

## ✅ After Adding NSG Rules

Once Azure NSG rules are added, test:

```bash
# Test direct IP
curl -k -I https://172.188.82.149

# Test domain
curl -I https://dev-ai-phone-call2.kimiyi.ai

# Run diagnostic
cd /var/www/kimiya-voice-dev && ./diagnose-connection.sh
```

Expected result: **HTTP/2 200** - Site loads instantly! 🚀

---

## 📝 Files Modified

1. ✅ `kimiya-voice-dev/backend/.env.development`
2. ✅ `kimiya-voice-dev/.env.development`
3. ✅ `/etc/nginx/sites-available/kimiyi-voice2.conf`
4. ✅ `kimiya-voice-dev/diagnose-connection.sh`
5. ✅ `kimiya-voice-dev/TROUBLESHOOTING-522-ERROR.md`

---

## 🎯 Summary

**All configuration changes are complete!**

- ✅ Domain updated to `dev-ai-phone-call2.kimiyi.ai`
- ✅ Ports configured correctly (3000, 3010)
- ✅ SSL certificates valid
- ✅ Nginx configured and reloaded
- ✅ PM2 services restarted
- ✅ Backend using new domain

**The site is ready to work - it just needs Azure NSG rules to allow external traffic!**

Once you add the Azure NSG rules, your site will be accessible at:
**https://dev-ai-phone-call2.kimiyi.ai** 🎉

---

## 🔧 Quick Commands

### Check Backend Status:
```bash
pm2 list
pm2 logs kimiya-voice-backend-dev --lines 20
```

### Check Nginx Status:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Test Local Connection:
```bash
curl -k -I https://localhost
curl -I http://localhost:3010/health
```

### Run Diagnostics:
```bash
cd /var/www/kimiya-voice-dev && ./diagnose-connection.sh
```

---

## 📞 Support

If you need help with Azure NSG configuration, refer to:
- `TROUBLESHOOTING-522-ERROR.md` - Detailed troubleshooting guide
- Azure Portal: https://portal.azure.com

