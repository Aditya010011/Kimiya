# 🔧 Port Configuration Guide

This guide explains the centralized port configuration system for the Kimiya Voice project, which eliminates hardcoded ports and provides clear, conflict-free port allocation across all environments.

## 📋 Overview

The centralized port configuration system provides:
- **Consistent port allocation** across development, staging, and production
- **Conflict prevention** through centralized management
- **Environment-aware configuration** with automatic port selection
- **Easy maintenance** with single source of truth for all port definitions

## 🎯 Port Allocation Strategy

### Development Environment
| Service | Port | Purpose |
|---------|------|---------|
| Frontend Dev Server (Vite) | **3000** | React development server |
| Backend API Server | **3001** | Express.js API server |
| Vite Preview | **4173** | Production build preview |
| Node.js Debug | **9229** | Debugging interface |
| Alternative HTTP | **8080** | Backup/testing port |

### Staging Environment
| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Nginx) | **80/443** | Web server (HTTP/HTTPS) |
| Backend API Server | **3002** | Express.js API server |
| Node.js Debug | **9230** | Debugging interface |
| Alternative HTTP | **8080** | Backup access |

### Production Environment
| Service | Port | Purpose |
|---------|------|---------|
| Frontend (Nginx) | **80/443** | Web server (HTTP/HTTPS) |
| Backend API Server | **3001** | Express.js API server |
| Alternative HTTP | **8080** | IP-based access |

## 🔧 Configuration Files

### Core Configuration
- **`config/ports.cjs`** - Main port configuration file (CommonJS)
- **`config/ports.d.ts`** - TypeScript definitions

### Environment Files
- **`.env.development`** - Development environment variables
- **`.env.staging`** - Staging environment variables
- **`.env`** - Production environment variables (default)

### PM2 Configurations
- **`config/pm2/development.config.cjs`** - Development PM2 config
- **`config/pm2/staging.config.cjs`** - Staging PM2 config
- **`config/pm2/production.config.cjs`** - Production PM2 config

### Nginx Configurations
- **`config/nginx/generate-nginx-config.sh`** - Nginx config generator
- **`config/nginx/generated/`** - Generated nginx configurations

## 🚀 Usage

### Display Port Configuration
```bash
# Show ports for all environments
make show-ports

# Show ports for specific environment
node -e "const { displayPortConfig } = require('./config/ports.cjs'); displayPortConfig('development');"
```

### Validate Port Configuration
```bash
# Validate all environments
make validate-ports

# Check for port conflicts
make check-port-conflicts
```

### Generate Nginx Configurations
```bash
# Generate all nginx configurations
make generate-nginx

# Generate specific environment
./config/nginx/generate-nginx-config.sh production ai-phone-call.kimiyi.ai 20.255.99.49
```

### Start Services with Correct Ports

#### Development
```bash
# Start frontend (port 3000)
npm run dev

# Start backend (port 3001)
cd backend && npm run dev

# Or use PM2
NODE_ENV=development pm2 start config/pm2/development.config.cjs
```

#### Production
```bash
# Start with PM2
NODE_ENV=production pm2 start config/pm2/production.config.cjs

# Deploy nginx configuration
./config/nginx/deploy-nginx-production.sh
```

## 🔍 API Usage

### JavaScript/Node.js
```javascript
const { getPort, getBackendUrl, getFrontendUrl } = require('./config/ports.cjs');

// Get specific port
const backendPort = getPort('backend.api', 'development'); // 3001
const frontendPort = getPort('frontend.dev', 'development'); // 3000

// Get URLs
const backendUrl = getBackendUrl('development'); // http://localhost:3001
const frontendUrl = getFrontendUrl('development'); // http://localhost:3000
```

### TypeScript
```typescript
import { getPort, getBackendUrl } from './config/ports.cjs';

const port: number = getPort('backend.api', 'production');
const url: string = getBackendUrl('production');
```

## 🛠️ Configuration Structure

### Port Configuration Object
```javascript
{
  development: {
    frontend: { dev: 3000, preview: 4173 },
    backend: { api: 3001, debug: 9229 },
    alternative: { http: 8080, backend_alt: 3010 }
  },
  staging: {
    frontend: { http: 80, https: 443, alt_http: 8080 },
    backend: { api: 3002, debug: 9230 }
  },
  production: {
    frontend: { http: 80, https: 443, alt_http: 8080 },
    backend: { api: 3001, debug: 9229 }
  }
}
```

## 🔄 Migration from Hardcoded Ports

### Before (Hardcoded)
```javascript
const PORT = 3000; // ❌ Hardcoded
app.listen(PORT);
```

### After (Centralized)
```javascript
const { getPort } = require('./config/ports.cjs');
const PORT = getPort('backend.api', process.env.NODE_ENV); // ✅ Centralized
app.listen(PORT);
```

## 🚨 Troubleshooting

### Port Conflicts
```bash
# Check what's using a port
sudo netstat -tlnp | grep :3001

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:3001)
```

### Configuration Issues
```bash
# Validate configuration
make validate-ports

# Check environment variables
env | grep -E "(PORT|NODE_ENV)"

# Test port accessibility
curl http://localhost:3001/health
```

### Common Issues

1. **Port already in use**
   - Check running processes: `pm2 list`
   - Kill conflicting processes: `pm2 delete all`

2. **Environment mismatch**
   - Verify NODE_ENV: `echo $NODE_ENV`
   - Check .env files are properly loaded

3. **Nginx proxy issues**
   - Test nginx config: `sudo nginx -t`
   - Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

## 📚 Best Practices

1. **Always use centralized configuration**
   - Never hardcode ports in application code
   - Use `getPort()` function for dynamic port resolution

2. **Environment-specific configurations**
   - Use appropriate .env files for each environment
   - Validate configuration before deployment

3. **Port conflict prevention**
   - Run `make check-port-conflicts` before starting services
   - Use different port ranges for different environments

4. **Documentation**
   - Update this guide when adding new services
   - Document any custom port requirements

## 🔗 Related Files

- [`config/ports.cjs`](../config/ports.cjs) - Main configuration
- [`vite.config.ts`](../vite.config.ts) - Frontend configuration
- [`backend/server.js`](../backend/server.js) - Backend configuration
- [`Makefile`](../Makefile) - Automation commands
