# Frontend-Backend Connection Guide for Dual Environment Setup

## 🎯 Overview

This guide explains how the frontend connects to the backend in your dual environment setup and how to troubleshoot connection issues.

## 🔧 Connection Configuration

### Environment-Specific Backend URLs

| Environment | Frontend Port | Backend Port | API Base URL |
|-------------|---------------|--------------|--------------|
| **Development** | 3000 | 3010 | `http://localhost:3010` |
| **Production** | 80/443 | 3001 | `http://localhost:3001` or domain |

### Configuration Files

#### Development Environment (`/var/www/kimiya-voice-dev/`)
```bash
# .env.local (Frontend Vite variables)
VITE_BACKEND_PORT=3010
VITE_BACKEND_URL=http://localhost:3010
VITE_FRONTEND_URL=http://localhost:3000
VITE_NODE_ENV=development

# .env.development (Backend variables)
NODE_ENV=development
PORT=3010
BACKEND_PORT=3010
FRONTEND_PORT=3000
WEBHOOK_BASE_URL=http://localhost:3010
BACKEND_URL=http://localhost:3010
FRONTEND_URL=http://localhost:3000
```

#### Production Environment (`/var/www/kimiya-voice/`)
```bash
# .env.local (Frontend Vite variables)
VITE_BACKEND_PORT=3001
VITE_BACKEND_URL=http://localhost:3001
VITE_FRONTEND_URL=http://localhost:3000
VITE_NODE_ENV=production

# .env.production (Backend variables)
NODE_ENV=production
PORT=3001
WEBHOOK_BASE_URL=https://ai-phone-call.kimiyi.ai
```

## 🚀 How to Start Each Environment

### Development Environment
```bash
# Start development backend
cd /var/www/kimiya-voice-dev
NODE_ENV=development pm2 start config/pm2/development.config.cjs

# Start development frontend (in separate terminal)
cd /var/www/kimiya-voice-dev
npm run dev
# Frontend: http://localhost:3000
# Backend API: http://localhost:3010/api/
```

### Production Environment
```bash
# Start production backend
cd /var/www/kimiya-voice
NODE_ENV=production pm2 start config/pm2/production.config.cjs

# Production frontend served by Nginx
# Frontend: https://ai-phone-call.kimiyi.ai
# Backend API: https://ai-phone-call.kimiyi.ai/api/ (proxied)
```

### Quick Start Scripts
```bash
# Development (both backend + frontend)
./start-dev-server.sh

# Environment management
./manage-environments.sh start-dev
./manage-environments.sh start-prod
```

## 🔍 API Endpoint Testing

### Test Development Backend (Port 3010)
```bash
# Health check
curl -H "Origin: http://localhost:3000" http://localhost:3010/health

# Twilio config
curl -H "Origin: http://localhost:3000" http://localhost:3010/api/twilio-config

# Chat endpoint (requires proper payload)
curl -X POST -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3000" \
     -d '{"messages":[{"role":"user","content":"Hello"}]}' \
     http://localhost:3010/api/chat
```

### Test Production Backend (Port 3001)
```bash
# Health check
curl -H "Origin: https://ai-phone-call.kimiyi.ai" http://localhost:3001/health

# Twilio config
curl -H "Origin: https://ai-phone-call.kimiyi.ai" http://localhost:3001/api/twilio-config
```

## 🛠️ Frontend API Configuration

### API Base URL Logic (`src/utils/envConfig.ts`)
```typescript
export const getApiBaseUrl = (): string => {
  const environment = import.meta.env.MODE || 'development';

  if (environment === 'development') {
    // Development: Use explicit backend URL or default to port 3010
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3010';
  } else {
    // Production: Use domain or localhost with production port
    return import.meta.env.VITE_BACKEND_URL || 'https://ai-phone-call.kimiyi.ai';
  }
};
```

### API Service Usage (`src/services/apiService.ts`)
```typescript
// All API calls automatically use the correct base URL
const baseUrl = getApiBaseUrl(); // Returns correct URL for environment

// Example API calls
await fetch(`${baseUrl}/api/twilio-config`);
await fetch(`${baseUrl}/api/chat`, { method: 'POST', ... });
await fetch(`${baseUrl}/health`);
```

## 🚫 Common CORS Issues and Solutions

### Issue: "Access to fetch at 'http://localhost:3000/api/chat' from origin 'http://localhost:3000' has been blocked by CORS policy"

**Problem**: Frontend is trying to call API on the same port as the frontend server.

**Solution**: 
1. Check that `.env.local` has correct `VITE_BACKEND_PORT`
2. Restart the frontend dev server after changing environment variables
3. Verify backend is running on the expected port

```bash
# Check what's running on each port
ss -tlnp | grep ':3000\|:3001\|:3010'

# Should show:
# *:3000 - Frontend dev server
# *:3001 - Production backend
# *:3010 - Development backend
```

### Issue: "Failed to fetch" or "Network Error"

**Problem**: Backend is not running or wrong port.

**Solution**:
```bash
# Check PM2 processes
pm2 list

# Check specific backend logs
pm2 logs kimiya-voice-backend-dev  # Development
pm2 logs kimiya-voice-backend      # Production

# Restart if needed
pm2 restart kimiya-voice-backend-dev
```

### Issue: CORS headers missing

**Problem**: Backend CORS not configured properly.

**Solution**: CORS is now centrally configured and should work automatically. If issues persist:
```bash
# Restart backend to apply CORS changes
pm2 restart kimiya-voice-backend-dev
pm2 restart kimiya-voice-backend
```

## 🔄 Environment Switching

### Switch from Production to Development
```bash
# Stop production frontend dev server (if running)
# Kill any process on port 3000

# Start development environment
cd /var/www/kimiya-voice-dev
npm run dev
# Now frontend connects to development backend (port 3010)
```

### Switch from Development to Production
```bash
# Stop development frontend
# Ctrl+C in the terminal running npm run dev

# Production frontend is served by Nginx
# Access via https://ai-phone-call.kimiyi.ai
```

## ✅ Verification Checklist

- [ ] Development backend running on port 3010
- [ ] Production backend running on port 3001
- [ ] Development frontend can start on port 3000
- [ ] Frontend connects to correct backend based on environment
- [ ] API calls work without CORS errors
- [ ] Both environments can run simultaneously

## 🎯 Quick Troubleshooting

1. **Check ports**: `ss -tlnp | grep ':3000\|:3001\|:3010'`
2. **Check PM2**: `pm2 list`
3. **Check environment variables**: Look at `.env.local` files
4. **Test API directly**: Use curl commands above
5. **Check browser console**: Look for CORS or network errors
6. **Restart services**: `pm2 restart all` and restart frontend dev server

## 📝 Key Points

✅ **Development**: Frontend (3000) → Backend (3010)  
✅ **Production**: Frontend (80/443) → Backend (3001)  
✅ **CORS**: Configured for all ports and origins  
✅ **Environment Variables**: Separate `.env.local` files for each environment  
✅ **API Base URL**: Automatically detects correct backend URL  

Your frontend should now correctly connect to the appropriate backend based on the environment! 🚀
