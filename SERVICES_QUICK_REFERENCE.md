# Kimiya Voice - Services Quick Reference Card

**Quick access guide for managing persistent services**

---

## 🚀 INITIAL SETUP (One-time)

```bash
# 1. Make scripts executable
chmod +x /var/www/kimiya-voice-dev/setup-persistent-services.sh
chmod +x /var/www/kimiya-voice-dev/manage-services.sh

# 2. Run setup (requires sudo)
sudo /var/www/kimiya-voice-dev/setup-persistent-services.sh

# 3. Verify services are running
cd /var/www/kimiya-voice-dev
./manage-services.sh status
```

---

## 📊 DAILY COMMANDS

### Check Status
```bash
./manage-services.sh status
```

### View Logs
```bash
# All logs
./manage-services.sh logs

# Backend only
./manage-services.sh logs-backend

# Frontend only
./manage-services.sh logs-frontend

# Real-time monitoring
./manage-services.sh monit
```

### Control Services
```bash
# Start all
./manage-services.sh start

# Stop all
./manage-services.sh stop

# Restart all
./manage-services.sh restart

# Restart backend only
./manage-services.sh restart-backend

# Restart frontend only
./manage-services.sh restart-frontend
```

---

## 🌐 ACCESS URLS

| Service | URL |
|---------|-----|
| **Development** | https://dev-ai-phone-call.kimiyi.ai/ |
| **Backend API** | http://localhost:3010 |
| **Frontend Dev** | http://localhost:3000 |

---

## 📁 IMPORTANT LOCATIONS

| Item | Path |
|------|------|
| **Project Root** | `/var/www/kimiya-voice-dev/` |
| **Backend Logs** | `/var/www/kimiya-voice-dev/backend/logs/` |
| **Frontend Logs** | `/var/www/kimiya-voice-dev/logs/` |
| **PM2 Config** | `/var/www/kimiya-voice-dev/ecosystem-dev.config.cjs` |
| **Management Script** | `/var/www/kimiya-voice-dev/manage-services.sh` |

---

## 🔧 DIRECT PM2 COMMANDS

```bash
# List all services
pm2 list

# View all logs
pm2 logs

# View backend logs
pm2 logs kimiya-voice-backend-dev

# View frontend logs
pm2 logs kimiya-voice-frontend-dev

# Real-time monitoring
pm2 monit

# Get backend info
pm2 info kimiya-voice-backend-dev

# Get frontend info
pm2 info kimiya-voice-frontend-dev

# Save configuration
pm2 save

# Show auto-start status
pm2 startup

# Disable auto-start
pm2 unstartup
```

---

## 🆘 QUICK TROUBLESHOOTING

### Services Not Running?
```bash
# Check status
./manage-services.sh status

# View logs
./manage-services.sh logs

# Restart
./manage-services.sh restart
```

### Port Already in Use?
```bash
# Check what's using port 3000
lsof -i :3000

# Check what's using port 3010
lsof -i :3010

# Kill process on port 3000
sudo lsof -ti:3000 | xargs kill -9

# Kill process on port 3010
sudo lsof -ti:3010 | xargs kill -9
```

### Frontend Not Accessible?
```bash
# Check frontend service
./manage-services.sh status

# Check nginx
sudo systemctl status nginx

# Restart nginx
sudo systemctl restart nginx

# Test nginx config
sudo nginx -t
```

### Backend API Not Responding?
```bash
# Check backend service
./manage-services.sh status

# View backend logs
./manage-services.sh logs-backend

# Test API
curl http://localhost:3010/api/health

# Restart backend
./manage-services.sh restart-backend
```

---

## 📈 MONITORING DASHBOARD

```bash
# Real-time monitoring (press 'q' to exit)
./manage-services.sh monit
```

Shows:
- CPU usage per process
- Memory usage per process
- Process status
- Uptime

---

## 🔄 AUTO-RESTART BEHAVIOR

Services are configured to:
- ✅ Auto-restart if they crash
- ✅ Auto-start on VM reboot
- ✅ Restart with file changes (hot reload)
- ✅ Max 10 restart attempts
- ✅ 10 second minimum uptime before counting as failed

---

## 📝 LOG VIEWING

### View Last 50 Lines
```bash
tail -50 /var/www/kimiya-voice-dev/backend/logs/combined.log
tail -50 /var/www/kimiya-voice-dev/logs/frontend-combined.log
```

### Follow Logs in Real-Time
```bash
tail -f /var/www/kimiya-voice-dev/backend/logs/combined.log
tail -f /var/www/kimiya-voice-dev/logs/frontend-combined.log
```

### Search Logs for Errors
```bash
grep -i error /var/www/kimiya-voice-dev/backend/logs/combined.log
grep -i error /var/www/kimiya-voice-dev/logs/frontend-combined.log
```

---

## 🎯 COMMON SCENARIOS

### Scenario 1: Deploy New Code
```bash
cd /var/www/kimiya-voice-dev
git pull origin main
npm install
./manage-services.sh restart
```

### Scenario 2: Check if Services Survived SSH Disconnect
```bash
# After reconnecting via SSH
./manage-services.sh status

# Should show both services as "online"
```

### Scenario 3: VM Rebooted
```bash
# After VM reboot, services should auto-start
# Verify with:
./manage-services.sh status

# Should show both services as "online"
```

### Scenario 4: Need to Stop Services Temporarily
```bash
./manage-services.sh stop

# Do maintenance...

# Restart when done
./manage-services.sh start
```

### Scenario 5: Only Frontend Needs Restart
```bash
./manage-services.sh restart-frontend

# Backend continues running
```

---

## 📞 SUPPORT

### Get Help
```bash
./manage-services.sh help
```

### View Full Documentation
```bash
cat /var/www/kimiya-voice-dev/PERSISTENT_SERVICES_SETUP.md
```

### Check PM2 Documentation
```bash
pm2 help
```

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] `./manage-services.sh status` shows both services as "online"
- [ ] https://dev-ai-phone-call.kimiyi.ai/ is accessible
- [ ] http://localhost:3010/api/ responds
- [ ] Log files exist in `/var/www/kimiya-voice-dev/logs/`
- [ ] Services restart after `./manage-services.sh restart`
- [ ] Services survive SSH disconnection
- [ ] Services auto-start after VM reboot

---

## 🔑 KEY POINTS

1. **Persistent**: Services run continuously in background
2. **Auto-Restart**: Services restart if they crash
3. **Auto-Start**: Services start automatically on VM reboot
4. **Centralized**: All logs in one place
5. **Easy Management**: Simple commands for daily operations
6. **Hot Reload**: Code changes auto-reload without restart

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**Status**: ✅ Production Ready

