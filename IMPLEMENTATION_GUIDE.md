# Kimiya Voice - Persistent Services Implementation Guide

**Complete step-by-step guide to set up persistent frontend and backend services**

**Date**: October 26, 2025  
**Status**: ✅ Ready for Implementation  
**Estimated Time**: 10-15 minutes

--- 

## 📋 WHAT YOU'LL GET

After following this guide, you'll have:

✅ **Frontend (Vite dev server)** running persistently on port 3000  
✅ **Backend (Node.js API)** running persistently on port 3010  
✅ **Auto-restart** on service failure  
✅ **Auto-start** on VM reboot  
✅ **Centralized logging** for both services  
✅ **Easy management** commands  
✅ **24/7 accessibility** at https://dev-ai-phone-call.kimiyi.ai/  

---

## 🔧 PREREQUISITES

- Ubuntu VM with SSH access
- Node.js and npm installed
- Sudo access (for initial setup only)
- Nginx configured and running
- Backend already running on port 3010 (optional, will be started by setup)

---

## 📦 FILES PROVIDED

| File | Purpose |
|------|---------|
| `ecosystem-dev.config.cjs` | PM2 configuration for both services |
| `setup-persistent-services.sh` | Initial setup script (run once with sudo) |
| `manage-services.sh` | Daily management script (no sudo needed) |
| `PERSISTENT_SERVICES_SETUP.md` | Detailed documentation |
| `SERVICES_QUICK_REFERENCE.md` | Quick reference card |
| `IMPLEMENTATION_GUIDE.md` | This file |

---

## 🚀 STEP-BY-STEP IMPLEMENTATION

### Step 1: Verify Prerequisites (2 minutes)

```bash
# Check Node.js is installed
node --version
npm --version

# Check Nginx is running
sudo systemctl status nginx

# Check if PM2 is installed
pm2 --version 2>/dev/null || echo "PM2 not installed (will be installed by setup)"

# Verify project directory
ls -la /var/www/kimiya-voice-dev/package.json
```

**Expected Output:**
- Node.js version 16+
- npm version 8+
- Nginx status: active (running)
- Project directory exists

---

### Step 2: Review Configuration Files (2 minutes)

```bash
# Review PM2 configuration
cat /var/www/kimiya-voice-dev/ecosystem-dev.config.cjs

# Review setup script
head -50 /var/www/kimiya-voice-dev/setup-persistent-services.sh

# Review management script
head -50 /var/www/kimiya-voice-dev/manage-services.sh
```

**What to verify:**
- Backend port: 3010 ✓
- Frontend port: 3000 ✓
- Log directories configured ✓
- Auto-restart enabled ✓

---

### Step 3: Run Setup Script (5 minutes)

```bash
# Navigate to project directory
cd /var/www/kimiya-voice-dev

# Run setup with sudo
sudo ./setup-persistent-services.sh
```

**What the script does:**
1. ✅ Checks permissions (requires sudo)
2. ✅ Creates log directories
3. ✅ Installs PM2 globally (if needed)
4. ✅ Stops any existing services
5. ✅ Starts both frontend and backend
6. ✅ Configures auto-start on reboot
7. ✅ Displays service status

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  KIMIYA VOICE - PERSISTENT SERVICES SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[INFO] Setting up logs directory...
[SUCCESS] Logs directory created
[INFO] Checking PM2 installation...
[SUCCESS] PM2 is installed: 5.x.x
...
[SUCCESS] ✅ Services are now running persistently!
```

---

### Step 4: Verify Services Are Running (2 minutes)

```bash
# Check service status
./manage-services.sh status
```

**Expected Output:**
```
┌─────────────────────────────────────────────────────────────┐
│ id │ name                        │ namespace │ version │ mode │
├─────────────────────────────────────────────────────────────┤
│ 0  │ kimiya-voice-backend-dev    │ default   │ 1.0.0   │ fork │
│ 1  │ kimiya-voice-frontend-dev   │ default   │ 1.0.0   │ fork │
└─────────────────────────────────────────────────────────────┘

✅ Backend service is RUNNING
✅ Frontend service is RUNNING
```

---

### Step 5: Test Accessibility (2 minutes)

```bash
# Test backend API
curl http://localhost:3010/api/health

# Test frontend (should return HTML)
curl http://localhost:3000 | head -20

# Test via nginx (if configured)
curl https://dev-ai-phone-call.kimiyi.ai/ | head -20
```

**Expected Results:**
- Backend API responds with health status
- Frontend returns HTML content
- HTTPS URL accessible via nginx

---

### Step 6: Test Persistence (3 minutes)

```bash
# Close SSH session and reconnect
# Then verify services are still running:
./manage-services.sh status

# Should show both services as "online"
```

**Expected Result:**
- Both services still running after SSH disconnect
- No manual restart needed

---

### Step 7: Test Auto-Restart (2 minutes)

```bash
# Stop backend service
./manage-services.sh stop-backend

# Wait 5 seconds
sleep 5

# Check status (should show backend restarting)
./manage-services.sh status

# Backend should be back online
```

**Expected Result:**
- Backend automatically restarts after being stopped
- Service recovers without manual intervention

---

## ✅ VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] Setup script ran successfully
- [ ] Both services show as "online" in `pm2 list`
- [ ] Backend API responds at http://localhost:3010/api/
- [ ] Frontend accessible at http://localhost:3000
- [ ] HTTPS URL works: https://dev-ai-phone-call.kimiyi.ai/
- [ ] Log files created in `/var/www/kimiya-voice-dev/logs/`
- [ ] Services survive SSH disconnection
- [ ] Services auto-restart on failure
- [ ] Auto-start configured for VM reboot

---

## 📊 DAILY OPERATIONS

### Check Status
```bash
cd /var/www/kimiya-voice-dev
./manage-services.sh status
```

### View Logs
```bash
./manage-services.sh logs
```

### Restart Services
```bash
./manage-services.sh restart
```

### Real-Time Monitoring
```bash
./manage-services.sh monit
```

---

## 🆘 TROUBLESHOOTING

### Issue: Setup Script Fails

**Solution:**
```bash
# Run with verbose output
bash -x ./setup-persistent-services.sh

# Check PM2 installation
pm2 --version

# Check Node.js
node --version
```

### Issue: Services Not Starting

**Solution:**
```bash
# Check logs
./manage-services.sh logs

# Check if ports are in use
lsof -i :3000
lsof -i :3010

# Kill processes on ports if needed
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:3010 | xargs kill -9

# Restart services
./manage-services.sh restart
```

### Issue: Frontend Not Accessible

**Solution:**
```bash
# Check frontend service
./manage-services.sh status

# Check nginx
sudo systemctl status nginx

# Verify nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Issue: Backend API Not Responding

**Solution:**
```bash
# Check backend logs
./manage-services.sh logs-backend

# Test API
curl http://localhost:3010/api/health

# Restart backend
./manage-services.sh restart-backend
```

---

## 📚 ADDITIONAL RESOURCES

### Quick Reference
```bash
cat /var/www/kimiya-voice-dev/SERVICES_QUICK_REFERENCE.md
```

### Detailed Documentation
```bash
cat /var/www/kimiya-voice-dev/PERSISTENT_SERVICES_SETUP.md
```

### PM2 Documentation
```bash
pm2 help
```

---

## 🎯 NEXT STEPS

1. ✅ Run setup script: `sudo ./setup-persistent-services.sh`
2. ✅ Verify services: `./manage-services.sh status`
3. ✅ Test access: Visit https://dev-ai-phone-call.kimiyi.ai/
4. ✅ Monitor logs: `./manage-services.sh logs`
5. ✅ Test persistence: Close SSH and reconnect
6. ✅ Share access with QA team

---

## 📞 SUPPORT

### Get Help
```bash
./manage-services.sh help
```

### View All Available Commands
```bash
./manage-services.sh
```

### Check PM2 Status
```bash
pm2 list
pm2 logs
pm2 monit
```

---

## 🔐 SECURITY NOTES

- Setup script requires sudo (one-time only)
- Daily management doesn't require sudo
- Services run as azureuser
- Logs stored in project directory
- Auto-start configured for azureuser account

---

## ✨ BENEFITS

✅ **No More Manual Restarts**: Services auto-restart on failure  
✅ **24/7 Availability**: Services run continuously  
✅ **Easy Management**: Simple commands for all operations  
✅ **Centralized Logging**: All logs in one place  
✅ **Auto-Start on Reboot**: Services start automatically  
✅ **Hot Reload**: Code changes auto-reload  
✅ **QA Ready**: Continuous access for testing  

---

**Implementation Complete!** 🎉

Your Kimiya Voice application is now running persistently and will remain accessible even when you disconnect from your SSH session.

For daily operations, use: `./manage-services.sh [command]`

For detailed help, see: `SERVICES_QUICK_REFERENCE.md`

