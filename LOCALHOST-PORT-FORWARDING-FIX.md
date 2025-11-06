# Localhost Port Forwarding - Credit API Error Fix

## 🐛 Error Description

When accessing the app via `localhost:3000` (port forwarding), you're getting these errors:

```
Error refreshing credit summary: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
Error refreshing credit balance: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

## 🔍 Root Cause

The error `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` means:
- The frontend is trying to call API endpoints (e.g., `/api/credits/balance`)
- But it's receiving **HTML** instead of **JSON**
- This happens when requests are being intercepted/redirected by nginx or a proxy

## ✅ What Was Fixed

### 1. **Updated `envConfig.ts`** to support new domain:
- Added `dev-ai-phone-call2.kimiyi.ai` to domain checks
- Updated fallback URLs to use new domain
- Localhost detection remains unchanged

### 2. **Updated CORS Configuration** (`backend/utils/cors-config.js`):
- Added `https://dev-ai-phone-call2.kimiyi.ai` to allowed origins
- Localhost origins already included

### 3. **Backend Environment Variables** updated:
- `WEBHOOK_BASE_URL` → `https://dev-ai-phone-call2.kimiyi.ai`
- `STRIPE_WEBHOOK_URL` → `https://dev-ai-phone-call2.kimiyi.ai/api/stripe/webhook`

## 🔧 Solution for Port Forwarding

When using VSCode port forwarding to access `localhost:3000`, the issue is that:

1. **Frontend runs on**: `localhost:3000` (forwarded)
2. **Backend runs on**: `localhost:3010` (forwarded)
3. **The frontend tries to call**: `http://localhost:3010/api/credits/balance`
4. **But the request might be going through nginx** which returns HTML

### **Option 1: Direct Backend Access (Recommended)**

Make sure your frontend is calling the backend directly, not through nginx.

**Check your `.env` file:**
```bash
VITE_BACKEND_PORT=3010
VITE_API_BASE_URL=http://localhost:3010
```

**Restart the frontend:**
```bash
pm2 restart kimiya-voice-frontend-dev
```

### **Option 2: Use the Domain Instead**

Instead of using `localhost:3000`, access the app via the domain:
```
https://dev-ai-phone-call2.kimiyi.ai
```

This way, nginx will properly proxy all requests.

### **Option 3: Check Port Forwarding Settings**

If using VSCode port forwarding:

1. Open VSCode **Ports** panel
2. Make sure both ports are forwarded:
   - `3000` → Frontend
   - `3010` → Backend
3. Set visibility to **Public** for both ports
4. Access via the forwarded URLs

## 🧪 Testing

### Test 1: Check Backend Directly
```bash
curl http://localhost:3010/health
```
Expected: JSON response with health status

### Test 2: Check Backend API (without auth)
```bash
curl http://localhost:3010/api/credits/balance
```
Expected: JSON response with `"Access token required"` error

### Test 3: Check Frontend Environment
Open browser console and run:
```javascript
console.log(import.meta.env.VITE_BACKEND_PORT);
console.log(import.meta.env.VITE_API_BASE_URL);
```
Expected: `3010` and `http://localhost:3010`

### Test 4: Check API Base URL
In browser console:
```javascript
import { getApiBaseUrl } from './src/utils/envConfig';
console.log(getApiBaseUrl());
```
Expected: `http://localhost:3010` (when on localhost:3000)

## 🔍 Debugging Steps

### 1. Check Network Tab
1. Open browser DevTools → Network tab
2. Look for failed requests to `/api/credits/balance`
3. Check the **Request URL** - should be `http://localhost:3010/api/credits/balance`
4. Check the **Response** - if it's HTML, the request is being intercepted

### 2. Check if Backend is Running
```bash
pm2 list
pm2 logs kimiya-voice-backend-dev --lines 20
```

### 3. Check Backend Logs for CORS Errors
```bash
pm2 logs kimiya-voice-backend-dev | grep "CORS"
```

If you see: `🚫 CORS blocked origin: http://localhost:3000`
Then the CORS configuration needs to be updated (already done).

### 4. Check if Nginx is Intercepting
```bash
curl -I http://localhost:3000/api/credits/balance
```

If this returns HTML (200 OK with text/html), then nginx is intercepting.
If this returns 404 or connection refused, then it's going directly to backend (correct).

## 🎯 Quick Fix Commands

### Restart Backend with Updated Config:
```bash
cd /var/www/kimiya-voice-dev
pm2 restart kimiya-voice-backend-dev --update-env
```

### Restart Frontend:
```bash
pm2 restart kimiya-voice-frontend-dev
```

### Check Logs:
```bash
pm2 logs --lines 50
```

## 📝 Environment Variables Summary

### Backend (`.env.development` in `backend/`):
```bash
NODE_ENV=development
PORT=3010
WEBHOOK_BASE_URL=https://dev-ai-phone-call2.kimiyi.ai
```

### Frontend (`.env.development` in root):
```bash
NODE_ENV=development
VITE_BACKEND_PORT=3010
VITE_BACKEND_URL=https://dev-ai-phone-call2.kimiyi.ai
```

### Frontend (`.env` for local development):
```bash
VITE_API_BASE_URL=http://localhost:3010
API_PORT=3010
NODE_ENV=development
```

## 🚀 Recommended Workflow

### For Local Development (Port Forwarding):
1. Access via: `http://localhost:3000`
2. Frontend calls: `http://localhost:3010` (direct backend)
3. No nginx involved

### For Remote Development (Domain):
1. Access via: `https://dev-ai-phone-call2.kimiyi.ai`
2. Frontend calls: `https://dev-ai-phone-call2.kimiyi.ai/api/*` (proxied through nginx)
3. Nginx proxies to `localhost:3010`

## ⚠️ Common Issues

### Issue 1: "Access token required" error
**Cause**: Not logged in or token expired
**Fix**: Log in again

### Issue 2: CORS error in console
**Cause**: Origin not in allowed list
**Fix**: Already fixed - restart backend

### Issue 3: HTML instead of JSON
**Cause**: Request going through nginx instead of direct to backend
**Fix**: Check `envConfig.ts` - should return `http://localhost:3010` for localhost

### Issue 4: Connection refused
**Cause**: Backend not running
**Fix**: `pm2 restart kimiya-voice-backend-dev`

## 📞 Support

If issues persist:
1. Check `pm2 logs kimiya-voice-backend-dev`
2. Check browser Network tab for actual request URLs
3. Verify environment variables are loaded: `pm2 env 0`

