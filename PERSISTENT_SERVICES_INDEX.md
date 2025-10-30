# Kimiya Voice - Persistent Services Documentation Index

**Complete guide to all persistent services documentation and scripts**

---

## 📚 DOCUMENTATION FILES

### 1. START HERE: SETUP_SUMMARY.md
**Purpose**: Overview of the complete solution  
**Read Time**: 5 minutes  
**Contains**:
- Problem and solution overview
- Deliverables summary
- Quick start guide
- File locations
- Verification checklist

**When to Read**: First thing - get an overview of what's included

---

### 2. IMPLEMENTATION_GUIDE.md
**Purpose**: Step-by-step setup instructions  
**Read Time**: 10 minutes  
**Contains**:
- Prerequisites verification
- 7-step implementation process
- Verification checklist
- Troubleshooting guide
- Expected outputs

**When to Read**: Before running setup script

---

### 3. PERSISTENT_SERVICES_SETUP.md
**Purpose**: Detailed technical documentation  
**Read Time**: 15 minutes  
**Contains**:
- Complete overview
- Configuration details
- Log locations
- Auto-start setup
- Advanced troubleshooting
- Monitoring instructions

**When to Read**: For detailed information about configuration

---

### 4. SERVICES_QUICK_REFERENCE.md
**Purpose**: Quick reference card for daily operations  
**Read Time**: 5 minutes  
**Contains**:
- Common commands
- Access URLs
- Important locations
- Direct PM2 commands
- Quick troubleshooting
- Common scenarios

**When to Read**: Daily operations and quick lookups

---

### 5. PERSISTENT_SERVICES_README.md
**Purpose**: Overview and summary  
**Read Time**: 10 minutes  
**Contains**:
- Problem/solution overview
- Quick start guide
- File locations
- Documentation guide
- Service architecture
- Benefits summary

**When to Read**: For comprehensive overview

---

### 6. PERSISTENT_SERVICES_INDEX.md
**Purpose**: This file - navigation guide  
**Read Time**: 5 minutes  
**Contains**:
- Documentation index
- Script descriptions
- Configuration details
- Quick navigation

**When to Read**: To find what you need

---

## 🔧 EXECUTABLE SCRIPTS

### 1. setup-persistent-services.sh
**Purpose**: Initial setup (run once with sudo)  
**Size**: 6.3 KB  
**Executable**: ✓  
**Usage**:
```bash
cd /var/www/kimiya-voice-dev
sudo ./setup-persistent-services.sh
```

**What It Does**:
- Checks permissions (requires sudo)
- Creates log directories
- Installs PM2 globally (if needed)
- Stops any existing services
- Starts both frontend and backend
- Configures auto-start on reboot
- Displays service status

**When to Run**: Once during initial setup

---

### 2. manage-services.sh
**Purpose**: Daily service management (no sudo needed)  
**Size**: 6.3 KB  
**Executable**: ✓  
**Usage**:
```bash
cd /var/www/kimiya-voice-dev
./manage-services.sh [COMMAND]
```

**Available Commands**:
- `status` - Show service status
- `start` - Start all services
- `stop` - Stop all services
- `restart` - Restart all services
- `logs` - View all logs
- `logs-backend` - View backend logs
- `logs-frontend` - View frontend logs
- `monit` - Real-time monitoring
- `start-backend` - Start backend only
- `start-frontend` - Start frontend only
- `stop-backend` - Stop backend only
- `stop-frontend` - Stop frontend only
- `restart-backend` - Restart backend only
- `restart-frontend` - Restart frontend only
- `info-backend` - Show backend details
- `info-frontend` - Show frontend details
- `save` - Save PM2 configuration
- `help` - Show help message

**When to Use**: Daily operations and monitoring

---

## ⚙️ CONFIGURATION FILES

### 1. ecosystem-dev.config.cjs
**Purpose**: PM2 configuration for both services  
**Size**: 3.1 KB  
**Contains**:
- Backend service configuration
  - Name: `kimiya-voice-backend-dev`
  - Port: 3010
  - Script: `./backend/server.js`
  - Watch: Enabled (hot reload)
  - Auto-restart: Yes
  - Logs: `./backend/logs/`

- Frontend service configuration
  - Name: `kimiya-voice-frontend-dev`
  - Port: 3000
  - Command: `npm run dev`
  - Auto-restart: Yes
  - Logs: `./logs/`

**When to Modify**: Only if you need to change ports or logging

---

## 🚀 QUICK START PATHS

### Path 1: I Just Want to Get Started (5 minutes)
1. Read: `SETUP_SUMMARY.md`
2. Run: `sudo ./setup-persistent-services.sh`
3. Verify: `./manage-services.sh status`
4. Access: https://dev-ai-phone-call.kimiyi.ai/

### Path 2: I Want Detailed Instructions (15 minutes)
1. Read: `IMPLEMENTATION_GUIDE.md`
2. Verify prerequisites
3. Run: `sudo ./setup-persistent-services.sh`
4. Follow verification checklist
5. Test persistence

### Path 3: I Need Complete Understanding (30 minutes)
1. Read: `PERSISTENT_SERVICES_README.md`
2. Read: `PERSISTENT_SERVICES_SETUP.md`
3. Read: `IMPLEMENTATION_GUIDE.md`
4. Run: `sudo ./setup-persistent-services.sh`
5. Explore: `SERVICES_QUICK_REFERENCE.md`

### Path 4: I'm Troubleshooting (10 minutes)
1. Check: `./manage-services.sh status`
2. View: `./manage-services.sh logs`
3. Read: Troubleshooting section in `PERSISTENT_SERVICES_SETUP.md`
4. Or: `SERVICES_QUICK_REFERENCE.md` quick troubleshooting

---

## 📊 WHAT EACH FILE DOES

| File | Type | Purpose | Read Time |
|------|------|---------|-----------|
| `SETUP_SUMMARY.md` | Doc | Overview | 5 min |
| `IMPLEMENTATION_GUIDE.md` | Doc | Setup steps | 10 min |
| `PERSISTENT_SERVICES_SETUP.md` | Doc | Detailed info | 15 min |
| `SERVICES_QUICK_REFERENCE.md` | Doc | Quick lookup | 5 min |
| `PERSISTENT_SERVICES_README.md` | Doc | Overview | 10 min |
| `PERSISTENT_SERVICES_INDEX.md` | Doc | Navigation | 5 min |
| `ecosystem-dev.config.cjs` | Config | PM2 config | - |
| `setup-persistent-services.sh` | Script | Initial setup | - |
| `manage-services.sh` | Script | Daily ops | - |

---

## 🌐 ACCESS URLS

| Service | URL |
|---------|-----|
| **Development** | https://dev-ai-phone-call.kimiyi.ai/ |
| **Backend API** | http://localhost:3010 |
| **Frontend Dev** | http://localhost:3000 |

---

## 📁 FILE LOCATIONS

```
/var/www/kimiya-voice-dev/
├── ecosystem-dev.config.cjs          (PM2 configuration)
├── setup-persistent-services.sh      (Setup script)
├── manage-services.sh                (Management script)
├── SETUP_SUMMARY.md                  (Overview)
├── IMPLEMENTATION_GUIDE.md           (Setup instructions)
├── PERSISTENT_SERVICES_SETUP.md      (Detailed docs)
├── SERVICES_QUICK_REFERENCE.md       (Quick reference)
├── PERSISTENT_SERVICES_README.md     (Overview)
├── PERSISTENT_SERVICES_INDEX.md      (This file)
├── backend/
│   └── logs/                         (Backend logs)
├── logs/                             (Frontend logs)
└── ... (other project files)
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

## 🆘 QUICK HELP

### I need to...

**Check if services are running**
```bash
./manage-services.sh status
```

**View logs**
```bash
./manage-services.sh logs
```

**Restart services**
```bash
./manage-services.sh restart
```

**Monitor in real-time**
```bash
./manage-services.sh monit
```

**Get help**
```bash
./manage-services.sh help
```

**Read documentation**
```bash
cat IMPLEMENTATION_GUIDE.md
cat SERVICES_QUICK_REFERENCE.md
```

---

## 📞 SUPPORT

### For Setup Issues
→ Read: `IMPLEMENTATION_GUIDE.md` (Troubleshooting section)

### For Daily Operations
→ Read: `SERVICES_QUICK_REFERENCE.md`

### For Detailed Information
→ Read: `PERSISTENT_SERVICES_SETUP.md`

### For Quick Answers
→ Run: `./manage-services.sh help`

---

## 🎯 NEXT STEPS

1. **Choose Your Path** (see Quick Start Paths above)
2. **Read Relevant Documentation**
3. **Run Setup Script**: `sudo ./setup-persistent-services.sh`
4. **Verify Services**: `./manage-services.sh status`
5. **Test Access**: Visit https://dev-ai-phone-call.kimiyi.ai/
6. **Monitor**: Use `./manage-services.sh logs`

---

## 📊 STATISTICS

- **Total Files**: 9 (3 scripts/config + 6 documentation)
- **Total Size**: ~50 KB
- **Setup Time**: 5-10 minutes
- **Daily Management**: Simple commands
- **Auto-Restart**: Enabled
- **Auto-Start on Reboot**: Enabled

---

## ✨ KEY FEATURES

✅ Persistent Services - Run continuously  
✅ Auto-Restart - Recover from crashes  
✅ Auto-Start - Start on VM reboot  
✅ Easy Management - Simple commands  
✅ Centralized Logging - All logs in one place  
✅ Hot Reload - Code changes auto-reload  
✅ QA Ready - Continuous access  
✅ Production Ready - Proven solution  

---

**Status**: ✅ Complete and Ready  
**Last Updated**: October 26, 2025  
**Version**: 1.0

---

**Ready to get started?** → Start with `SETUP_SUMMARY.md` or `IMPLEMENTATION_GUIDE.md`

