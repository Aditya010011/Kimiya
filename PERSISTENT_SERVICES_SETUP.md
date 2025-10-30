# Kimiya Voice - Persistent Services Setup Guide

**Purpose**: Configure the Kimiya Voice application to run persistently on Ubuntu VM so that both frontend and backend remain accessible even when SSH sessions are closed.

**Status**: ✅ Ready for Implementation

---

## 📋 OVERVIEW

This guide sets up PM2 to manage both the frontend (Vite dev server) and backend (Node.js API) as persistent services that:

- ✅ Run continuously in the background
- ✅ Auto-restart on failure
- ✅ Auto-start on VM reboot
- ✅ Provide centralized logging
- ✅ Enable easy monitoring and management

---

## 🚀 QUICK START (5 minutes)

### Step 1: Make Scripts Executable

```bash
chmod +x /var/www/kimiya-voice-dev/setup-persistent-services.sh
chmod +x /var/www/kimiya-voice-dev/manage-services.sh
```

### Step 2: Run Setup Script (with sudo)

```bash
sudo /var/www/kimiya-voice-dev/setup-persistent-services.sh
```

This script will:
- ✅ Install PM2 globally (if not already installed)
- ✅ Stop any existing services
- ✅ Start both frontend and backend with PM2
- ✅ Configure auto-start on VM reboot
- ✅ Display service status and access URLs

### Step 3: Verify Services Are Running

```bash
./manage-services.sh status
```

Expected output:
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

### Step 4: Access the Application

- **Development URL**: https://dev-ai-phone-call.kimiyi.ai/
- **Backend API**: http://localhost:3010
- **Frontend Dev**: http://localhost:3000

---

## 📊 SERVICE MANAGEMENT

### View Service Status

```bash
./manage-services.sh status
```

### View Logs

```bash
# All logs
./manage-services.sh logs

# Backend logs only
./manage-services.sh logs-backend

# Frontend logs only
./manage-services.sh logs-frontend

# Real-time monitoring
./manage-services.sh monit
```

### Control Services

```bash
# Start all services
./manage-services.sh start

# Stop all services
./manage-services.sh stop

# Restart all services
./manage-services.sh restart

# Restart backend only
./manage-services.sh restart-backend

# Restart frontend only
./manage-services.sh restart-frontend
```

### Get Detailed Information

```bash
# Backend details
./manage-services.sh info-backend

# Frontend details
./manage-services.sh info-frontend
```

---

## 🔧 CONFIGURATION FILES

### 1. ecosystem-dev.config.cjs
**Location**: `/var/www/kimiya-voice-dev/ecosystem-dev.config.cjs`

Defines PM2 configuration for both services:
- Backend: Node.js API server on port 3010
- Frontend: Vite dev server on port 3000
- Auto-restart on failure
- File watching for hot reload
- Centralized logging

### 2. setup-persistent-services.sh
**Location**: `/var/www/kimiya-voice-dev/setup-persistent-services.sh`

Initial setup script that:
- Installs PM2 (if needed)
- Creates log directories
- Starts services
- Configures auto-start on reboot

### 3. manage-services.sh
**Location**: `/var/www/kimiya-voice-dev/manage-services.sh`

Daily management script for:
- Checking service status
- Starting/stopping/restarting services
- Viewing logs
- Real-time monitoring

---

## 📁 LOG LOCATIONS

### Backend Logs
```
/var/www/kimiya-voice-dev/backend/logs/
├── err.log          # Error output
├── out.log          # Standard output
└── combined.log     # Combined logs
```

### Frontend Logs
```
/var/www/kimiya-voice-dev/logs/
├── frontend-err.log      # Error output
├── frontend-out.log      # Standard output
└── frontend-combined.log # Combined logs
```

### View Logs

```bash
# Real-time backend logs
tail -f /var/www/kimiya-voice-dev/backend/logs/combined.log

# Real-time frontend logs
tail -f /var/www/kimiya-voice-dev/logs/frontend-combined.log

# Or use PM2
pm2 logs kimiya-voice-backend-dev
pm2 logs kimiya-voice-frontend-dev
```

---

## 🔄 AUTO-START ON REBOOT

After running `setup-persistent-services.sh`, services will automatically start when the VM reboots.

To verify auto-start is configured:

```bash
pm2 startup
```

To disable auto-start:

```bash
pm2 unstartup
```

---

## 🆘 TROUBLESHOOTING

### Services Not Starting

1. Check PM2 status:
```bash
pm2 list
```

2. View error logs:
```bash
./manage-services.sh logs-backend
./manage-services.sh logs-frontend
```

3. Check if ports are in use:
```bash
lsof -i :3000  # Frontend port
lsof -i :3010  # Backend port
```

4. Kill processes on ports (if needed):
```bash
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:3010 | xargs kill -9
```

### Frontend Not Accessible

1. Verify frontend is running:
```bash
./manage-services.sh status
```

2. Check nginx is running:
```bash
sudo systemctl status nginx
```

3. Verify nginx config:
```bash
sudo nginx -t
```

4. Restart nginx:
```bash
sudo systemctl restart nginx
```

### Backend API Not Responding

1. Check backend logs:
```bash
./manage-services.sh logs-backend
```

2. Verify database connection:
```bash
# Check if database is accessible
curl http://localhost:3010/api/health
```

3. Restart backend:
```bash
./manage-services.sh restart-backend
```

---

## 📈 MONITORING

### Real-Time Monitoring

```bash
./manage-services.sh monit
```

Shows:
- CPU usage
- Memory usage
- Process status
- Uptime

### Check Service Health

```bash
# Backend health check
curl http://localhost:3010/api/health

# Frontend health check
curl http://localhost:3000
```

---

## 🔐 SECURITY NOTES

1. **PM2 Configuration**: Stored in `/var/www/kimiya-voice-dev/ecosystem-dev.config.cjs`
2. **Log Files**: Accessible to azureuser (owner)
3. **Auto-Start**: Configured for azureuser account
4. **Permissions**: Scripts require sudo for setup, but not for daily management

---

## 📝 COMMON COMMANDS REFERENCE

| Command | Purpose |
|---------|---------|
| `./manage-services.sh status` | Check if services are running |
| `./manage-services.sh logs` | View all service logs |
| `./manage-services.sh restart` | Restart all services |
| `./manage-services.sh monit` | Real-time monitoring |
| `pm2 list` | List all PM2 processes |
| `pm2 logs` | View all PM2 logs |
| `pm2 save` | Save PM2 configuration |
| `pm2 startup` | Show auto-start status |

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] Both services show as "online" in `pm2 list`
- [ ] Frontend accessible at https://dev-ai-phone-call.kimiyi.ai/
- [ ] Backend API responding at http://localhost:3010/api/
- [ ] Log files created in `/var/www/kimiya-voice-dev/logs/`
- [ ] Auto-start configured (run `pm2 startup`)
- [ ] Services restart after manual stop/start
- [ ] Services survive SSH disconnection

---

## 🎯 NEXT STEPS

1. Run setup script: `sudo ./setup-persistent-services.sh`
2. Verify services: `./manage-services.sh status`
3. Test access: Visit https://dev-ai-phone-call.kimiyi.ai/
4. Monitor logs: `./manage-services.sh logs`
5. Test persistence: Close SSH session and verify URL still works

---

**For detailed PM2 documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/

**For support**: Check logs using `./manage-services.sh logs` or `pm2 logs`

