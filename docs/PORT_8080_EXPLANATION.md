# Port 8080 Explanation - Why Both Environments Use the Same Port

## 🤔 **The Question**
You noticed that both development and production environments show `http://localhost:8080/builder` as an access URL. This might seem confusing, but it's actually the correct and intended behavior.

## ✅ **Why Port 8080 is Shared (This is Correct!)**

Port 8080 is a **shared HTTP port** that serves different content based on which nginx configuration is currently active. Think of it as a "gateway" that changes its behavior based on the environment.

### 🔄 **How It Works**

```
Port 8080 = Shared Gateway
    ↓
[Current Nginx Config Determines Behavior]
    ↓
┌─ Development Config Active ─┐    ┌─ Production Config Active ─┐
│ Frontend: /var/www/kimiya-  │    │ Frontend: /var/www/kimiya- │
│          voice-dev/dist     │    │          voice/dist        │
│ API Proxy: → localhost:3010 │    │ API Proxy: → localhost:3001│
│ VSCode Support: Port 8081   │    │ Domain Access: ai-phone-   │
│ HTTPS: Port 8443           │    │               call.kimiyi.ai│
└────────────────────────────┘    └───────────────────────────┘
```

## 📊 **Current Status Comparison**

### **Development Environment Active**
```bash
./switch-nginx-environment.sh show
```
```
🔧 Current Environment: DEVELOPMENT
📁 Frontend Directory: /var/www/kimiya-voice-dev/dist
🔌 Backend Port: 3010 (Development API)
🌐 Access URLs:
   • http://localhost:8080/builder  (→ DEV frontend + DEV API)
   • http://localhost:8081/builder  (→ DEV frontend + DEV API, VSCode forwarding)
   • https://localhost:8443/builder (→ DEV frontend + DEV API, HTTPS)
📊 API Routing: All /api/* calls → http://localhost:3010
```

### **Production Environment Active**
```bash
./switch-nginx-environment.sh prod
./switch-nginx-environment.sh show
```
```
🏭 Current Environment: PRODUCTION
📁 Frontend Directory: /var/www/kimiya-voice/dist
🔌 Backend Port: 3001 (Production API)
🌐 Access URLs:
   • http://localhost:8080/builder        (→ PROD frontend + PROD API)
   • https://ai-phone-call.kimiyi.ai/builder (→ PROD frontend + PROD API)
📊 API Routing: All /api/* calls → http://localhost:3001
```

## 🎯 **Key Differences When Using Port 8080**

| Aspect | Development (8080) | Production (8080) |
|--------|-------------------|-------------------|
| **Frontend Files** | `/var/www/kimiya-voice-dev/dist` | `/var/www/kimiya-voice/dist` |
| **API Backend** | `localhost:3010` | `localhost:3001` |
| **Additional Ports** | 8081 (VSCode), 8443 (HTTPS) | Domain access |
| **CORS Origins** | Includes localhost:8081 | Production domains |
| **Build Source** | Development directory | Production directory |

## 🔍 **How to Verify Which Environment is Active**

### **Method 1: Check Nginx Configuration**
```bash
./switch-nginx-environment.sh show
```

### **Method 2: Test API Endpoint**
```bash
# Check which backend is responding
curl http://localhost:8080/health | jq '.environment.port'

# Development will return: "3010"
# Production will return: "3001"
```

### **Method 3: Check Frontend Build Timestamp**
```bash
# Development build
ls -la /var/www/kimiya-voice-dev/dist/index.html

# Production build  
ls -la /var/www/kimiya-voice/dist/index.html
```

## 🚀 **Practical Usage**

### **For Development (Current Setup)**
```bash
# Ensure development environment is active
./switch-nginx-environment.sh dev

# Access via VSCode port forwarding
http://localhost:8081/builder
# → Serves: /var/www/kimiya-voice-dev/dist
# → API calls: http://localhost:8081/api/* → proxied to localhost:3010

# Or access directly
http://localhost:8080/builder
# → Same behavior as above
```

### **For Production Testing**
```bash
# Switch to production environment
./switch-nginx-environment.sh prod

# Access the same port, different content
http://localhost:8080/builder
# → Serves: /var/www/kimiya-voice/dist  
# → API calls: http://localhost:8080/api/* → proxied to localhost:3001
```

## 🎯 **Benefits of This Design**

### ✅ **Advantages**
1. **Single Port Management**: Only need to remember port 8080 for HTTP access
2. **Easy Environment Switching**: Same URL, different backend/frontend
3. **VSCode Compatibility**: Port forwarding works consistently
4. **Production Simulation**: Can test production setup locally
5. **Nginx Efficiency**: Single nginx instance handles both environments

### ✅ **No Conflicts Because**
- Only one nginx configuration is active at a time
- Each configuration serves different directories
- Each configuration proxies to different backend ports
- Environment switching is atomic (all-or-nothing)

## 🔧 **Behind the Scenes**

### **Nginx Configuration Files**
```bash
# Development config
/etc/nginx/sites-available/kimiya-voice → kimiya-voice-development.conf
# Serves: /var/www/kimiya-voice-dev/dist
# Proxies: /api/* → http://localhost:3010

# Production config  
/etc/nginx/sites-available/kimiya-voice → kimiya-voice-production.conf
# Serves: /var/www/kimiya-voice/dist
# Proxies: /api/* → http://localhost:3001
```

### **Switching Process**
1. Build appropriate frontend
2. Copy new nginx config to `/etc/nginx/sites-available/kimiya-voice`
3. Test nginx configuration
4. Reload nginx (no restart needed)
5. Port 8080 now serves different content

## 📝 **Summary**

**Port 8080 showing in both environments is CORRECT and INTENTIONAL.**

- ✅ **Same Port**: `http://localhost:8080/builder`
- ✅ **Different Content**: Based on active nginx configuration
- ✅ **Different APIs**: Development (3010) vs Production (3001)
- ✅ **Easy Switching**: One command changes everything
- ✅ **VSCode Compatible**: Port 8081 always available for development

This design provides maximum flexibility while maintaining simplicity. You always know that port 8080 is your HTTP access point, regardless of which environment is active behind it.

## 🎯 **Current Recommendation**

Keep the development environment active for your VSCode workflow:
```bash
./switch-nginx-environment.sh dev
# Access via: http://localhost:8081/builder (VSCode port forwarding)
```

This gives you the development backend (port 3010) with full CORS support for your VSCode port forwarding setup! 🚀
