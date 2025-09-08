# Development Subdomain Setup Guide

## 🎯 **Overview**

This guide sets up `dev-ai-phone-call.kimiyi.ai` as the development subdomain for external webhook access. This allows services like Twilio to reach your development environment.

## 🔧 **Configuration Changes Made**

### **1. Updated Webhook Base URL**
```env
# Before (localhost - not accessible externally)
WEBHOOK_BASE_URL=http://localhost:3010

# After (public subdomain - accessible externally)
WEBHOOK_BASE_URL=https://dev-ai-phone-call.kimiyi.ai
```

### **2. SSL Certificate Locations**
- **Certificate**: `/etc/ssl/kimiya-ai/dev-ai-phone-call.crt`
- **Private Key**: `/etc/ssl/kimiya-ai/dev-ai-phone-call.key`

### **3. Nginx Configuration**
- **Domain**: `localhost dev-ai-phone-call.kimiyi.ai`
- **HTTPS Port**: 8443 (development)
- **Backend Proxy**: Port 3010

## 🔒 **SSL Certificate Installation**

### **Method 1: Using the Installation Script**

If you have the certificate files:
```bash
./install-dev-ssl-certificates.sh /path/to/cert.crt /path/to/private.key
```

### **Method 2: Manual Installation**

1. **Save the SSL certificate**:
```bash
sudo nano /etc/ssl/kimiya-ai/dev-ai-phone-call.crt
# Paste the certificate content (PEM format)
# Including -----BEGIN CERTIFICATE----- and -----END CERTIFICATE-----
```

2. **Save the private key**:
```bash
sudo nano /etc/ssl/kimiya-ai/dev-ai-phone-call.key
# Paste the private key content (PEM format)
# Including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----
```

3. **Set proper permissions**:
```bash
sudo chmod 644 /etc/ssl/kimiya-ai/dev-ai-phone-call.crt
sudo chmod 600 /etc/ssl/kimiya-ai/dev-ai-phone-call.key
sudo chown root:root /etc/ssl/kimiya-ai/dev-ai-phone-call.*
```

### **Method 3: Interactive Installation**
```bash
./install-dev-ssl-certificates.sh
# Follow the prompts to paste certificate content
```

## 🌐 **DNS Configuration**

Ensure DNS points to your server:
```
dev-ai-phone-call.kimiyi.ai → YOUR_SERVER_IP
```

### **Test DNS Resolution**
```bash
nslookup dev-ai-phone-call.kimiyi.ai
dig dev-ai-phone-call.kimiyi.ai
```

## 🔧 **Nginx Configuration Update**

The nginx configuration has been updated to:

1. **Support both domains**:
   - `localhost` (for local development)
   - `dev-ai-phone-call.kimiyi.ai` (for external webhooks)

2. **Use proper SSL certificates**:
   - Development subdomain certificate
   - Proper certificate chain

3. **Proxy to development backend**:
   - All requests → port 3010

## 🚀 **Deployment Steps**

### **1. Install SSL Certificates**
```bash
# Use one of the methods above to install certificates
./install-dev-ssl-certificates.sh
```

### **2. Regenerate Nginx Configuration**
```bash
cd /var/www/kimiya-voice
./config/nginx/generate-nginx-config.sh development
```

### **3. Deploy Development Environment**
```bash
./switch-nginx-environment.sh dev
```

### **4. Restart Backend with New Configuration**
```bash
pm2 restart kimiya-voice-backend-dev
```

## ✅ **Verification**

### **1. Test Local Access**
```bash
curl http://localhost:8080/health
curl https://localhost:8443/health -k
```

### **2. Test Subdomain Access**
```bash
curl https://dev-ai-phone-call.kimiyi.ai/health
```

### **3. Test Webhook Endpoints**
```bash
curl https://dev-ai-phone-call.kimiyi.ai/api/twilio-config
curl https://dev-ai-phone-call.kimiyi.ai/webhook/twilio
```

### **4. Verify SSL Certificate**
```bash
openssl s_client -connect dev-ai-phone-call.kimiyi.ai:443 -servername dev-ai-phone-call.kimiyi.ai
```

## 🎯 **Access URLs Summary**

| Purpose | URL | Notes |
|---------|-----|-------|
| **Local Development** | `http://localhost:8080/builder` | No SSL needed |
| **VSCode Port Forwarding** | `http://localhost:8081/builder` | Recommended for development |
| **Local HTTPS** | `https://localhost:8443/builder` | Self-signed certificate |
| **External Webhooks** | `https://dev-ai-phone-call.kimiyi.ai/builder` | Trusted certificate |
| **Production** | `https://ai-phone-call.kimiyi.ai/builder` | Production environment |

## 🔗 **Webhook Configuration**

### **Twilio Configuration**
Update your Twilio webhooks to use:
```
https://dev-ai-phone-call.kimiyi.ai/webhook/twilio
https://dev-ai-phone-call.kimiyi.ai/api/make-call-optimized
```

### **Other External Services**
All webhook URLs should now use:
```
https://dev-ai-phone-call.kimiyi.ai/api/[endpoint]
```

## 🛠️ **Troubleshooting**

### **Certificate Issues**
```bash
# Check certificate validity
sudo openssl x509 -in /etc/ssl/kimiya-ai/dev-ai-phone-call.crt -text -noout

# Check private key
sudo openssl rsa -in /etc/ssl/kimiya-ai/dev-ai-phone-call.key -check -noout

# Test nginx configuration
sudo nginx -t
```

### **DNS Issues**
```bash
# Test DNS resolution
nslookup dev-ai-phone-call.kimiyi.ai
ping dev-ai-phone-call.kimiyi.ai
```

### **Backend Issues**
```bash
# Check backend status
pm2 status
pm2 logs kimiya-voice-backend-dev

# Test backend directly
curl http://localhost:3010/health
```

## 📋 **Next Steps**

1. **Install SSL certificates** using the provided content
2. **Update DNS** to point subdomain to your server
3. **Test webhook endpoints** with external services
4. **Update Twilio configuration** to use new webhook URLs
5. **Monitor logs** for any issues

## 🎉 **Benefits**

✅ **External webhook access** - Twilio and other services can reach your development environment  
✅ **Proper SSL certificates** - No certificate warnings  
✅ **Dual environment support** - Local development + external webhooks  
✅ **Easy switching** - Switch between dev and production environments  
✅ **Secure connections** - All webhook traffic encrypted  

Your development environment is now ready for external webhook integration! 🚀
