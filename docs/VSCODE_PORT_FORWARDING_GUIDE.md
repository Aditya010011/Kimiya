# VSCode Port Forwarding Guide for Kimiya Voice

## 🎯 Overview

This guide explains how to use Kimiya Voice when accessing it through VSCode's port forwarding feature, which is common when developing on remote VMs or containers.

## 🔧 VSCode Port Forwarding Scenario

When you're working with a remote VM through VSCode, port forwarding automatically maps VM ports to your local machine:

```
VM Port 8080 → Local Port 8081 (VSCode forwarding)
```

This means:
- **VM**: Application runs on `http://localhost:8080`
- **Your Browser**: You access via `http://localhost:8081`

## ✅ Fixed Configuration

### CORS Configuration Updated

The backend now allows origins from VSCode port forwarding:

```javascript
// Added to backend/utils/cors-config.js
'http://localhost:8081',  // VSCode port forwarding (8080 → 8081)
'https://localhost:8081', // VSCode port forwarding HTTPS
```

### Frontend API Detection Enhanced

The frontend now intelligently detects forwarded ports:

```typescript
// Updated in src/utils/envConfig.ts
if (port === '8080' || port === '8081') {
  // Development HTTP access through nginx proxy (including VSCode port forwarding)
  // Use the same origin for API calls (nginx will proxy to correct backend)
  return `${protocol}//${hostname}:${port}`;
}

// For ports in the 8000-9000 range (likely forwarded)
if (parseInt(port) > 8000 && parseInt(port) < 9000) {
  // Likely a forwarded port - use nginx proxy
  return `${protocol}//${hostname}:${port}`;
}
```

### Nginx Configuration Updated

Nginx now listens on both the original port and the forwarded port:

```nginx
# HTTP server block for development access
server {
    listen 8080;
    listen 8081;  # VSCode port forwarding support
    server_name localhost 127.0.0.1;
    
    # API proxy to development backend
    location /api/ {
        proxy_pass http://localhost:3010;
        # ... CORS and proxy headers
    }
}
```

## 🚀 How It Works Now

### Access Flow with VSCode Port Forwarding

```
Browser (localhost:8081) 
    ↓ 
VSCode Port Forwarding 
    ↓ 
VM Nginx (port 8081) 
    ↓ 
VM Backend (port 3010)
```

### API Call Flow

1. **Frontend loads**: `http://localhost:8081/builder`
2. **API detection**: Frontend detects port 8081 as forwarded port
3. **API calls**: `http://localhost:8081/api/*` (through nginx proxy)
4. **Nginx proxy**: Routes to `http://localhost:3010/api/*`
5. **Backend response**: Includes CORS headers for `localhost:8081`

## ✅ Verification Results

All endpoints now work correctly with VSCode port forwarding:

```bash
# Test API through nginx proxy
curl -H "Origin: http://localhost:8081" http://localhost:8081/api/twilio-config
# ✅ {"success":true,"config":{...}}

# Test health endpoint
curl -H "Origin: http://localhost:8081" http://localhost:8081/health
# ✅ {"status":"healthy",...,"port":"3010",...}

# Test direct backend (for debugging)
curl -H "Origin: http://localhost:8081" http://localhost:3010/api/twilio-config
# ✅ {"success":true,"config":{...}}
```

## 🔍 Troubleshooting VSCode Port Forwarding

### Common Issues and Solutions

#### Issue: "CORS policy: No 'Access-Control-Allow-Origin' header"
**Solution**: Backend now includes `localhost:8081` in allowed origins ✅

#### Issue: "net::ERR_FAILED 500 (Internal Server Error)"
**Solution**: Frontend now uses nginx proxy instead of direct backend calls ✅

#### Issue: API calls going to wrong port
**Solution**: Enhanced frontend detection for forwarded ports ✅

### Debug Commands

```bash
# Check what ports nginx is listening on
ss -tlnp | grep nginx

# Check current nginx configuration
./switch-nginx-environment.sh show

# Test API endpoints
curl -H "Origin: http://localhost:8081" http://localhost:8081/api/twilio-config
curl -H "Origin: http://localhost:8081" http://localhost:8081/health

# Check backend logs
pm2 logs kimiya-voice-backend-dev --lines 10
```

## 🛠️ Development Workflow with VSCode

### Setup Steps

1. **Start Development Environment**:
   ```bash
   ./switch-nginx-environment.sh dev
   ```

2. **Access Application**:
   - VSCode will automatically forward port 8080 to 8081
   - Open browser to `http://localhost:8081/builder`

3. **Development**:
   - Make changes in `/var/www/kimiya-voice-dev/`
   - Rebuild frontend: `cd /var/www/kimiya-voice-dev && npm run build`
   - Backend changes auto-reload with PM2

### Port Mapping Reference

| VM Port | VSCode Forwarded | Purpose | Status |
|---------|------------------|---------|--------|
| 8080 | 8081 | Development HTTP | ✅ Working |
| 8443 | 8444 | Development HTTPS | ✅ Supported |
| 3000 | 3001 | Frontend Dev Server | ✅ Supported |
| 3010 | 3011 | Backend Direct Access | ✅ Supported |

## 🎯 Key Benefits

✅ **Seamless VSCode Integration**: Works with automatic port forwarding  
✅ **No Manual Configuration**: Frontend automatically detects forwarded ports  
✅ **CORS Compatibility**: All forwarded ports included in CORS policy  
✅ **Nginx Proxy Support**: API calls routed through nginx for consistency  
✅ **Debug Friendly**: Direct backend access still available for debugging  

## 📝 Configuration Files Updated

- `backend/utils/cors-config.js` - Added VSCode forwarded ports
- `src/utils/envConfig.ts` - Enhanced port detection logic
- `config/nginx/generated/kimiya-voice-development.conf` - Added port 8081 listener
- Development backend files synced with latest CORS configuration

## 🚀 Result

**Your VSCode port forwarding scenario now works perfectly!**

- ✅ Access: `http://localhost:8081/builder`
- ✅ API calls: `http://localhost:8081/api/*` → proxied to backend
- ✅ No CORS errors
- ✅ No 500 Internal Server Errors
- ✅ Full development workflow supported

The application now seamlessly handles VSCode's automatic port forwarding while maintaining proper CORS security and API routing! 🎉
