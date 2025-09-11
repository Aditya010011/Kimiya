# SSL Certificate Guide for Kimiya Voice Dual Environment

## 🔒 **SSL Certificate Overview**

Your Kimiya Voice setup now uses **different SSL certificates for different environments**:

### **Production Environment**
- **Certificate**: CloudFlare Origin Certificate
- **Domain**: `ai-phone-call.kimiyi.ai`
- **Location**: `/etc/ssl/kimiya-ai/ai-phone-call.crt`
- **Valid Until**: September 1, 2027
- **Access**: `https://ai-phone-call.kimiyi.ai`

### **Development Environment**
- **Certificate**: CloudFlare Origin Certificate
- **Domain**: `dev-ai-phone-call.kimiyi.ai`
- **Location**: `/etc/ssl/kimiya-ai/dev-ai-phone-call-new.crt`
- **Valid Until**: September 5, 2027
- **Access**: `https://dev-ai-phone-call.kimiyi.ai:8443`

## 🎯 **Why Different Certificates?**

### **The Solution**
Both environments now use **CloudFlare Origin Certificates** with proper domain validation:
- ✅ Production: `ai-phone-call.kimiyi.ai` (port 443)
- ✅ Development: `dev-ai-phone-call.kimiyi.ai` (port 8443)
- ✅ Both certificates are trusted by CloudFlare
- ✅ No browser warnings when accessing via proper domains

## 🔧 **Current SSL Configuration**

### **Development Environment (Port 8443)**
```nginx
server {
    listen 8443 ssl http2;
    server_name localhost;
    
    # SSL configuration for localhost development
    ssl_certificate /etc/ssl/localhost/localhost.crt;
    ssl_certificate_key /etc/ssl/localhost/localhost.key;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    # ... other SSL settings
}
```

### **Production Environment (Port 443)**
```nginx
server {
    listen 443 ssl http2;
    server_name ai-phone-call.kimiyi.ai;
    
    # SSL configuration for production domain
    ssl_certificate /etc/ssl/kimiya-ai/ai-phone-call.crt;
    ssl_certificate_key /etc/ssl/kimiya-ai/ai-phone-call.key;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    # ... other SSL settings
}
```

## 🌐 **Browser Behavior**

### **Production Domain** (`https://ai-phone-call.kimiyi.ai`)
- ✅ **Secure**: Shows green lock icon
- ✅ **Trusted**: CloudFlare Origin Certificate
- ✅ **No Warnings**: Certificate matches domain

### **Development Localhost** (`https://localhost:8443`)
- ⚠️ **Self-Signed Warning**: Browser shows security warning
- ✅ **Functional**: Works after accepting warning
- ✅ **Remembered**: Browser remembers your choice

## 🔍 **How to Accept Self-Signed Certificate**

### **Chrome/Edge**
1. Navigate to `https://localhost:8443/builder`
2. You'll see "Your connection is not private"
3. Click **"Advanced"**
4. Click **"Proceed to localhost (unsafe)"**
5. ✅ Certificate is now accepted and remembered

### **Firefox**
1. Navigate to `https://localhost:8443/builder`
2. You'll see "Warning: Potential Security Risk Ahead"
3. Click **"Advanced..."**
4. Click **"Accept the Risk and Continue"**
5. ✅ Certificate is now accepted and remembered

### **Safari**
1. Navigate to `https://localhost:8443/builder`
2. You'll see "This Connection Is Not Private"
3. Click **"Show Details"**
4. Click **"visit this website"**
5. Click **"Visit Website"** in the popup
6. ✅ Certificate is now accepted and remembered

## 🛠️ **SSL Management Commands**

### **View Certificate Details**
```bash
# Development certificate
sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -text -noout

# Production certificate
sudo openssl x509 -in /etc/ssl/kimiya-ai/ai-phone-call.crt -text -noout
```

### **Test SSL Connections**
```bash
# Test development HTTPS (ignore certificate warnings)
curl -k https://localhost:8443/health

# Test production HTTPS
curl https://ai-phone-call.kimiyi.ai/health
```

### **Recreate Development Certificate**
```bash
# Run the setup script
./setup-development-ssl.sh

# Or manually
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/localhost/localhost.key \
  -out /etc/ssl/localhost/localhost.crt \
  -subj "/C=US/ST=Development/L=Development/O=Kimiya Voice Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1"
```

## 🔄 **Environment Switching Impact**

### **When Switching to Development**
```bash
./switch-nginx-environment.sh dev
```
- ✅ Nginx uses localhost SSL certificate
- ✅ HTTPS works on port 8443
- ⚠️ Browser shows self-signed warning (first time)

### **When Switching to Production**
```bash
./switch-nginx-environment.sh prod
```
- ✅ Nginx uses CloudFlare SSL certificate
- ✅ HTTPS works on port 443
- ✅ No browser warnings for domain access

## 🎯 **Recommended Usage**

### **For Development (VSCode Port Forwarding)**
```bash
# Ensure development environment is active
./switch-nginx-environment.sh dev

# Access via HTTPS (accept certificate warning once)
https://localhost:8443/builder

# Or use HTTP (no certificate needed)
http://localhost:8081/builder  # VSCode port forwarding
http://localhost:8080/builder  # Direct access
```

### **For Production Testing**
```bash
# Switch to production environment
./switch-nginx-environment.sh prod

# Access via trusted HTTPS
https://ai-phone-call.kimiyi.ai/builder
```

## 🔒 **Security Considerations**

### **Development Certificate**
- ⚠️ **Self-Signed**: Not trusted by default
- ✅ **Local Only**: Only valid for localhost
- ✅ **Temporary**: For development purposes only
- ✅ **Secure Connection**: Still encrypts traffic

### **Production Certificate**
- ✅ **Trusted**: CloudFlare Origin Certificate
- ✅ **Domain Validated**: Matches ai-phone-call.kimiyi.ai
- ✅ **Long Validity**: Valid until 2027
- ✅ **Production Ready**: Suitable for live traffic

## 📋 **Troubleshooting**

### **"Not Secure" on Port 8443**
1. **Expected Behavior**: Self-signed certificates show warnings
2. **Solution**: Accept the certificate warning in your browser
3. **Alternative**: Use HTTP on port 8080/8081 instead

### **Certificate Expired**
```bash
# Check certificate expiry
sudo openssl x509 -in /etc/ssl/localhost/localhost.crt -noout -dates

# Recreate if expired
./setup-development-ssl.sh
```

### **Nginx SSL Errors**
```bash
# Test nginx configuration
sudo nginx -t

# Check SSL certificate paths
sudo ls -la /etc/ssl/localhost/
sudo ls -la /etc/ssl/kimiya-ai/
```

## ✅ **Summary**

Your SSL setup is now **properly configured for dual environments**:

- 🔒 **Development**: Self-signed certificate for localhost (port 8443)
- 🔒 **Production**: CloudFlare certificate for domain (port 443)
- 🔄 **Automatic**: Environment switching handles certificates
- 🛡️ **Secure**: All HTTPS traffic is encrypted
- 🎯 **Flexible**: Choose HTTP or HTTPS for development

**For your VSCode workflow**: Use `http://localhost:8081/builder` (no certificate warnings) or accept the self-signed certificate once for `https://localhost:8443/builder` and enjoy encrypted development! 🚀
