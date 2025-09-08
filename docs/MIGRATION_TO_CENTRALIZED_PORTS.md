# 🔄 Migration to Centralized Port Configuration

This document outlines the migration from hardcoded ports to the centralized port configuration system in the Kimiya Voice project.

## 📋 Migration Summary

### What Changed
- **Removed hardcoded ports** from all configuration files
- **Implemented centralized port management** via `config/ports.js`
- **Updated environment files** with standardized port definitions
- **Created environment-specific configurations** for development, staging, and production
- **Generated dynamic nginx configurations** based on port configuration
- **Updated PM2 configurations** to use centralized ports

### Benefits
- ✅ **No more port conflicts** between environments
- ✅ **Single source of truth** for all port definitions
- ✅ **Environment-aware configuration** with automatic port selection
- ✅ **Easy maintenance** and updates
- ✅ **Consistent deployment** across different environments

## 🔧 Changes Made

### 1. Core Configuration System
**Created:**
- `config/ports.js` - Main port configuration
- `config/ports.d.ts` - TypeScript definitions

### 2. Environment Files Updated
**Before:**
```bash
# .env.development (old)
PORT=8081
BACKEND_PORT=3004
```

**After:**
```bash
# .env.development (new)
NODE_ENV=development
PORT=3001
BACKEND_PORT=3001
FRONTEND_PORT=3000
```

### 3. Backend Server Configuration
**Before:**
```javascript
// backend/server.js (old)
const PORT = process.env.PORT || 3000; // Hardcoded fallback
```

**After:**
```javascript
// backend/server.js (new)
const { getPort } = require('../config/ports.js');
const PORT = getPort('backend.api', environment);
```

### 4. Frontend Configuration
**Before:**
```typescript
// vite.config.ts (old)
server: {
  port: 8080, // Hardcoded
}
```

**After:**
```typescript
// vite.config.ts (new)
const { getPort } = require("./config/ports.js");
const frontendPort = getPort('frontend.dev', environment);
server: {
  port: frontendPort,
}
```

### 5. PM2 Configuration
**Before:**
```javascript
// ecosystem.config.cjs (old)
env: {
  PORT: 3001 // Hardcoded
}
```

**After:**
```javascript
// config/pm2/production.config.cjs (new)
const { getPort } = require('../ports.js');
const backendPort = getPort('backend.api', 'production');
env: {
  PORT: backendPort
}
```

### 6. Nginx Configuration
**Before:**
- Static nginx configuration files with hardcoded ports

**After:**
- Dynamic nginx configuration generation via `config/nginx/generate-nginx-config.sh`
- Environment-specific configurations in `config/nginx/generated/`

## 🎯 New Port Allocation

### Development Environment
| Service | Old Port | New Port | Notes |
|---------|----------|----------|-------|
| Frontend Dev | 8080 | **3000** | Standard Vite default |
| Backend API | 3004/8081 | **3001** | Consistent across environments |
| Debug | 9229 | **9229** | Unchanged |

### Staging Environment
| Service | Port | Notes |
|---------|------|-------|
| Frontend | **80/443** | Served by Nginx |
| Backend API | **3002** | Unique staging port |
| Debug | **9230** | Staging-specific debug port |

### Production Environment
| Service | Old Port | New Port | Notes |
|---------|----------|----------|-------|
| Frontend | 80/443 | **80/443** | Unchanged |
| Backend API | 3001 | **3001** | Unchanged |
| Alt HTTP | 8080 | **8080** | Unchanged |

## 🚀 Migration Steps for Existing Deployments

### 1. Update Configuration Files
```bash
# Pull latest changes
git pull origin main

# Validate new port configuration
make validate-ports

# Show new port allocation
make show-ports
```

### 2. Update Environment Variables
```bash
# Backup existing environment files
cp .env .env.backup
cp .env.development .env.development.backup

# Environment files are already updated in the repository
# Verify they match your needs
cat .env.development
cat .env
```

### 3. Update PM2 Configuration
```bash
# Stop existing PM2 processes
pm2 delete all

# Start with new configuration
NODE_ENV=production pm2 start config/pm2/production.config.cjs

# Save PM2 configuration
pm2 save
```

### 4. Update Nginx Configuration
```bash
# Generate new nginx configuration
make generate-nginx

# Deploy new configuration
./config/nginx/deploy-nginx-production.sh

# Verify nginx is working
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Verify Services
```bash
# Check PM2 processes
pm2 list

# Check port usage
make check-port-conflicts

# Test backend API
curl http://localhost:3001/health

# Test frontend (if applicable)
curl http://localhost:3000
```

## 🔍 Verification Checklist

### ✅ Configuration Validation
- [ ] Port configuration validates without errors: `make validate-ports`
- [ ] No port conflicts detected: `make check-port-conflicts`
- [ ] Environment variables are correctly set
- [ ] PM2 processes start successfully

### ✅ Service Functionality
- [ ] Backend API responds on correct port
- [ ] Frontend development server starts on port 3000
- [ ] Nginx proxies requests correctly
- [ ] WebSocket connections work (ConversationRelay)

### ✅ Environment Consistency
- [ ] Development environment uses ports 3000/3001
- [ ] Production environment uses port 3001 for backend
- [ ] Staging environment uses port 3002 for backend
- [ ] All environments have unique port allocations

## 🚨 Troubleshooting

### Port Conflicts
If you encounter port conflicts:
```bash
# Check what's using the port
sudo netstat -tlnp | grep :3001

# Kill conflicting processes
sudo kill -9 $(sudo lsof -t -i:3001)

# Restart services
pm2 restart all
```

### Configuration Issues
If configuration validation fails:
```bash
# Check Node.js version (requires Node 16+)
node --version

# Verify config file exists
ls -la config/ports.js

# Test configuration manually
node -e "console.log(require('./config/ports.js').getPort('backend.api', 'development'))"
```

### Service Startup Issues
If services fail to start:
```bash
# Check PM2 logs
pm2 logs

# Check environment variables
env | grep -E "(NODE_ENV|PORT)"

# Verify file permissions
ls -la config/pm2/
```

## 📚 Additional Resources

- [Port Configuration Guide](./PORT_CONFIGURATION_GUIDE.md) - Complete usage guide
- [Debug Guide](./guides/debug-guide.md) - Updated debugging information
- [Deployment Guide](../UBUNTU_DEPLOYMENT_GUIDE.md) - Deployment procedures

## 🔗 Related Changes

### Files Modified
- `backend/server.js` - Updated to use centralized ports
- `vite.config.ts` - Dynamic port configuration
- `src/utils/envConfig.ts` - Environment-aware URL generation
- `ecosystem.config.cjs` - Updated PM2 configuration
- All `.env*` files - Standardized port definitions
- `Makefile` - Added port management commands

### Files Added
- `config/ports.js` - Main configuration
- `config/ports.d.ts` - TypeScript definitions
- `config/pm2/*.config.cjs` - Environment-specific PM2 configs
- `config/nginx/generate-nginx-config.sh` - Nginx generator
- `docs/PORT_CONFIGURATION_GUIDE.md` - Usage documentation

### Files Deprecated
- Old hardcoded nginx configurations (replaced by generated ones)
- Environment-specific hardcoded port values

## 💡 Best Practices Going Forward

1. **Never hardcode ports** - Always use `getPort()` function
2. **Validate before deployment** - Run `make validate-ports`
3. **Use environment-specific configs** - Leverage the PM2 and nginx generators
4. **Document port changes** - Update the port configuration guide
5. **Test across environments** - Verify development, staging, and production
