# CORS Configuration Guide for Kimiya Voice Dual Environment Setup

## 🎯 Overview

This guide explains the comprehensive CORS (Cross-Origin Resource Sharing) configuration implemented for the Kimiya Voice dual environment setup. The configuration ensures seamless communication between frontend and backend services across all ports and environments.

## 🔧 Architecture

### Centralized CORS Management

The CORS configuration is centralized in `backend/utils/cors-config.js` to:
- ✅ Eliminate code duplication
- ✅ Ensure consistency across all endpoints
- ✅ Simplify maintenance and updates
- ✅ Support dynamic environment-based configuration

### Supported Environments

| Environment | Backend Port | Frontend Ports | CORS Configuration |
|-------------|--------------|----------------|-------------------|
| **Production** | 3001 | 80, 443 (Nginx) | Production domains + localhost |
| **Development** | 3010 | 3000 (Vite) | All development ports + production |
| **Staging** | 3002 | 80, 443 (Nginx) | Staging + development ports |

## 🌐 Allowed Origins

### Production Origins
```
https://ai-phone-call.kimiyi.ai
http://ai-phone-call.kimiyi.ai
```

### Development Origins
```
http://localhost:3000   # Development frontend (Vite)
http://localhost:3001   # Production backend
http://localhost:3010   # Development backend
http://localhost:8080   # Development HTTP
http://localhost:8443   # Development HTTPS
http://localhost:4173   # Vite preview
http://localhost:5173   # Alternative Vite port
```

### HTTPS Variants
```
https://localhost:3000
https://localhost:3001
https://localhost:3010
https://localhost:8080
https://localhost:8443
https://localhost:4173
https://localhost:5173
```

### Server IP Origins
```
http://20.255.99.49
http://20.255.99.49:8080
http://20.255.99.49:8443
https://20.255.99.49
https://20.255.99.49:8080
https://20.255.99.49:8443
```

### VM Internal Access
```
http://127.0.0.1:3000
http://127.0.0.1:3001
http://127.0.0.1:3010
http://127.0.0.1:8080
http://127.0.0.1:8443
```

### Legacy/Compatibility Origins
```
https://kimiya-ai.vercel.app
http://kimiya-ai.vercel.app
```

## 🛠️ Implementation Details

### Core Utility Functions

#### `getAllowedOrigins(environment)`
Returns array of all allowed origins for the specified environment.

#### `setDynamicCorsHeaders(req, res, environment)`
Sets appropriate CORS headers based on request origin and environment.

#### `createCorsOptions(environment)`
Creates CORS options object for Express cors middleware.

#### `isOriginAllowed(origin, environment)`
Validates if a specific origin is allowed for the environment.

### Usage Examples

#### In Main Server (server.js)
```javascript
const { createCorsOptions, setDynamicCorsHeaders } = require('./utils/cors-config');

// Use centralized CORS options
const corsOptions = createCorsOptions(environment);
app.use(cors(corsOptions));

// For specific endpoints
app.get('/health', (req, res) => {
  setDynamicCorsHeaders(req, res, environment);
  // ... endpoint logic
});
```

#### In Route Files
```javascript
const { setDynamicCorsHeaders } = require('../utils/cors-config');

module.exports = async function handler(req, res) {
  // Set CORS headers
  setDynamicCorsHeaders(req, res, process.env.NODE_ENV);
  
  // ... route logic
};
```

## 🔍 CORS Headers Set

### Standard Headers
- `Access-Control-Allow-Origin`: Dynamic based on request origin
- `Access-Control-Allow-Methods`: GET, POST, PUT, DELETE, OPTIONS, PATCH
- `Access-Control-Allow-Credentials`: true
- `Access-Control-Allow-Headers`: Comprehensive list including:
  - Content-Type
  - Authorization
  - X-Requested-With
  - Accept
  - Origin
  - Cache-Control
  - X-File-Name
  - X-HTTP-Method-Override

### Environment-Specific Behavior

#### Production Environment
- Strict origin validation
- Defaults to `https://ai-phone-call.kimiyi.ai`
- Includes localhost for development testing

#### Development Environment
- Permissive origin validation
- Defaults to `http://localhost:3000`
- Includes all development ports and variants

## 🚀 Testing CORS Configuration

### Test Development Backend (Port 3010)
```bash
# Test with development origin
curl -H "Origin: http://localhost:3000" http://localhost:3010/health

# Test with production origin
curl -H "Origin: https://ai-phone-call.kimiyi.ai" http://localhost:3010/health

# Test preflight request
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS http://localhost:3010/api/make-call-optimized
```

### Test Production Backend (Port 3001)
```bash
# Test with production origin
curl -H "Origin: https://ai-phone-call.kimiyi.ai" http://localhost:3001/health

# Test with development origin
curl -H "Origin: http://localhost:3000" http://localhost:3001/health
```

## 🔧 Configuration Files

### Main Configuration
- `backend/utils/cors-config.js` - Centralized CORS utility
- `backend/server.js` - Main server CORS setup

### Route-Specific CORS
- `backend/routes/make-call-optimized.js` - Uses centralized utility
- `backend/routes/test-tts-endpoint.js` - Uses centralized utility
- All other route files automatically inherit from main server CORS

## 🛡️ Security Considerations

### Origin Validation
- All origins are explicitly whitelisted
- No wildcard (*) origins in production
- Request origins are validated against allowed list

### Credentials Handling
- `Access-Control-Allow-Credentials: true` for authenticated requests
- Secure cookie handling across origins

### Headers Security
- Only necessary headers are allowed
- No sensitive headers exposed

## 🔄 Environment Switching

The CORS configuration automatically adapts based on `NODE_ENV`:

```bash
# Development environment
NODE_ENV=development npm start
# Allows all development ports + production origins

# Production environment  
NODE_ENV=production npm start
# Strict production origins + localhost for testing
```

## 📝 Maintenance

### Adding New Origins
1. Edit `backend/utils/cors-config.js`
2. Add new origin to appropriate environment section
3. Restart backend services
4. Test new origin access

### Debugging CORS Issues
1. Check browser developer console for CORS errors
2. Review backend logs for blocked origins
3. Verify origin is in allowed list
4. Test with curl commands

## ✅ Verification Checklist

- [ ] Development frontend (3000) can access development backend (3010)
- [ ] Development frontend (3000) can access production backend (3001)
- [ ] Production frontend can access production backend (3001)
- [ ] All preflight OPTIONS requests work correctly
- [ ] CORS headers are set on all endpoints
- [ ] No CORS errors in browser console
- [ ] Both environments can run simultaneously without CORS conflicts

## 🎯 Benefits

✅ **Dual Environment Support**: Both environments work simultaneously  
✅ **Port Flexibility**: All development and production ports supported  
✅ **Centralized Management**: Single source of truth for CORS configuration  
✅ **Environment Awareness**: Automatic adaptation based on NODE_ENV  
✅ **Security**: Explicit origin whitelisting with no wildcards  
✅ **Maintainability**: Easy to add new origins or modify configuration  
✅ **Testing Friendly**: Supports localhost testing in all environments  

Your CORS configuration now fully supports the dual environment setup with comprehensive port coverage! 🚀
