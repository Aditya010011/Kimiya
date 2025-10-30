# Kimiya Voice - Persistent Services Solution

**Complete solution for running Kimiya Voice frontend and backend persistently on Ubuntu VM**

---

## 🎯 PROBLEM SOLVED

**Before**: Frontend server stops when SSH session closes → URL becomes inaccessible  
**After**: Both frontend and backend run persistently → URL always accessible

---

## 📦 WHAT'S INCLUDED

### Configuration Files
- **`ecosystem-dev.config.cjs`** - PM2 configuration for both services

### Setup & Management Scripts
- **`setup-persistent-services.sh`** - Initial setup (run once with sudo)
- **`manage-services.sh`** - Daily management (no sudo needed)

### Documentation
- **`IMPLEMENTATION_GUIDE.md`** - Step-by-step setup instructions
- **`PERSISTENT_SERVICES_SETUP.md`** - Detailed documentation
- **`SERVICES_QUICK_REFERENCE.md`** - Quick reference card
- **`PERSISTENT_SERVICES_README.md`** - This file

---

## ⚡ QUICK START (5 minutes)

### 1. Run Setup Script
```bash
cd /var/www/kimiya-voice-dev
sudo ./setup-persistent-services.sh
```

### 2. Verify Services
```bash
./manage-services.sh status
```

### 3. Access Application
- **Development**: https://dev-ai-phone-call.kimiyi.ai/
- **Backend API**: http://localhost:3010
- **Frontend Dev**: http://localhost:3000

---

## 📊 WHAT YOU GET

✅ **Persistent Services**
- Frontend (Vite dev server) runs continuously
- Backend (Node.js API) runs continuously
- Both survive SSH disconnection

✅ **Auto-Restart**
- Services restart if they crash
- Max 10 restart attempts
- 10 second minimum uptime

✅ **Auto-Start on Reboot**
- Services start automatically when VM reboots
- No manual intervention needed

✅ **Centralized Logging**
- Backend logs: `/var/www/kimiya-voice-dev/backend/logs/`
- Frontend logs: `/var/www/kimiya-voice-dev/logs/`
- Easy access via `pm2 logs`

✅ **Easy Management**
- Simple commands for all operations
- Real-time monitoring available
- Detailed status information

---

## 🔧 DAILY COMMANDS

```bash
cd /var/www/kimiya-voice-dev

# Check status
./manage-services.sh status

# View logs
./manage-services.sh logs

# Restart services
./manage-services.sh restart

# Real-time monitoring
./manage-services.sh monit

# Get help
./manage-services.sh help
```

---

## 📁 FILE LOCATIONS

| Item | Location |
|------|----------|
| **Project Root** | `/var/www/kimiya-voice-dev/` |
| **PM2 Config** | `/var/www/kimiya-voice-dev/ecosystem-dev.config.cjs` |
| **Setup Script** | `/var/www/kimiya-voice-dev/setup-persistent-services.sh` |
| **Management Script** | `/var/www/kimiya-voice-dev/manage-services.sh` |
| **Backend Logs** | `/var/www/kimiya-voice-dev/backend/logs/` |
| **Frontend Logs** | `/var/www/kimiya-voice-dev/logs/` |

---

## 🌐 ACCESS URLS

| Service | URL |
|---------|-----|
| **Development** | https://dev-ai-phone-call.kimiyi.ai/ |
| **Backend API** | http://localhost:3010 |
| **Frontend Dev** | http://localhost:3000 |

---

## 📖 DOCUMENTATION GUIDE

### For Initial Setup
→ Read: **`IMPLEMENTATION_GUIDE.md`**
- Step-by-step instructions
- Verification checklist
- Troubleshooting guide

### For Daily Operations
→ Read: **`SERVICES_QUICK_REFERENCE.md`**
- Common commands
- Quick troubleshooting
- Monitoring tips

### For Detailed Information
→ Read: **`PERSISTENT_SERVICES_SETUP.md`**
- Complete configuration details
- Log locations
- Advanced troubleshooting

---

## 🚀 IMPLEMENTATION STEPS

### Step 1: Verify Prerequisites
```bash
node --version  # Should be 16+
npm --version   # Should be 8+
sudo systemctl status nginx  # Should be active
```

### Step 2: Run Setup
```bash
cd /var/www/kimiya-voice-dev
sudo ./setup-persistent-services.sh
```

### Step 3: Verify Services
```bash
./manage-services.sh status
```

### Step 4: Test Access
```bash
# Test backend
curl http://localhost:3010/api/health

# Test frontend
curl http://localhost:3000

# Test via HTTPS
curl https://dev-ai-phone-call.kimiyi.ai/
```

### Step 5: Test Persistence
```bash
# Close SSH session and reconnect
# Then verify:
./manage-services.sh status
```

---

## 🔄 SERVICE ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│         Nginx (Reverse Proxy)                       │
│  https://dev-ai-phone-call.kimiyi.ai:443           │
└──────────────┬──────────────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   ┌────────┐    ┌──────────┐
   │Frontend│    │ Backend  │
   │ Vite   │    │ Node.js  │
   │:3000   │    │ :3010    │
   └────────┘    └──────────┘
        │             │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │    PM2      │
        │ (Process    │
        │ Manager)    │
        └─────────────┘
```

---

## 📊 SERVICE DETAILS

### Backend Service
- **Name**: `kimiya-voice-backend-dev`
- **Port**: 3010
- **Script**: `./backend/server.js`
- **Watch**: Enabled (hot reload)
- **Auto-Restart**: Yes
- **Logs**: `./backend/logs/`

### Frontend Service
- **Name**: `kimiya-voice-frontend-dev`
- **Port**: 3000
- **Command**: `npm run dev`
- **Watch**: Vite handles internally
- **Auto-Restart**: Yes
- **Logs**: `./logs/`

---

## 🆘 QUICK TROUBLESHOOTING

### Services Not Running?
```bash
./manage-services.sh status
./manage-services.sh logs
./manage-services.sh restart
```

### Port Already in Use?
```bash
lsof -i :3000  # Check port 3000
lsof -i :3010  # Check port 3010
sudo lsof -ti:3000 | xargs kill -9  # Kill process
```

### Frontend Not Accessible?
```bash
./manage-services.sh status
sudo systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx
```

### Backend API Not Responding?
```bash
./manage-services.sh logs-backend
curl http://localhost:3010/api/health
./manage-services.sh restart-backend
```

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] Both services show as "online" in `pm2 list`
- [ ] Frontend accessible at https://dev-ai-phone-call.kimiyi.ai/
- [ ] Backend API responding at http://localhost:3010/api/
- [ ] Log files created in `/var/www/kimiya-voice-dev/logs/`
- [ ] Services survive SSH disconnection
- [ ] Services auto-restart on failure
- [ ] Auto-start configured for VM reboot

---

## 📞 SUPPORT

### Get Help
```bash
./manage-services.sh help
```

### View Logs
```bash
./manage-services.sh logs
pm2 logs
```

### Monitor Services
```bash
./manage-services.sh monit
pm2 monit
```

### Check PM2 Status
```bash
pm2 list
pm2 info kimiya-voice-backend-dev
pm2 info kimiya-voice-frontend-dev
```

---

## 🎯 BENEFITS

✅ **24/7 Availability** - Services run continuously  
✅ **Auto-Restart** - Services recover from crashes  
✅ **Auto-Start** - Services start on VM reboot  
✅ **Easy Management** - Simple commands for all operations  
✅ **Centralized Logging** - All logs in one place  
✅ **Hot Reload** - Code changes auto-reload  
✅ **QA Ready** - Continuous access for testing  
✅ **Production Ready** - Proven PM2 solution  

---

## 📝 NEXT STEPS

1. **Read**: `IMPLEMENTATION_GUIDE.md` for step-by-step instructions
2. **Run**: `sudo ./setup-persistent-services.sh` to set up services
3. **Verify**: `./manage-services.sh status` to check services
4. **Test**: Visit https://dev-ai-phone-call.kimiyi.ai/ to access application
5. **Monitor**: Use `./manage-services.sh logs` to view logs
6. **Share**: Provide URL to QA team for continuous testing

---

## 📚 DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_GUIDE.md` | Step-by-step setup instructions |
| `PERSISTENT_SERVICES_SETUP.md` | Detailed documentation |
| `SERVICES_QUICK_REFERENCE.md` | Quick reference card |
| `PERSISTENT_SERVICES_README.md` | This overview file |
| `ecosystem-dev.config.cjs` | PM2 configuration |
| `setup-persistent-services.sh` | Setup script |
| `manage-services.sh` | Management script |

---

**Status**: ✅ Ready for Implementation  
**Last Updated**: October 26, 2025  
**Version**: 1.0

---

**Ready to get started?** → Read `IMPLEMENTATION_GUIDE.md` and run `sudo ./setup-persistent-services.sh`

