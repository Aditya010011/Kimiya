# Debug & Deployment Guide

## 🔧 Port Configuration System

This project uses a centralized port configuration system. See [`docs/PORT_CONFIGURATION_GUIDE.md`](../PORT_CONFIGURATION_GUIDE.md) for complete details.

### Quick Port Reference
- **Development Frontend**: 3000 (Vite dev server)
- **Development Backend**: 3001 (Express API)
- **Production Frontend**: 80/443 (Nginx)
- **Production Backend**: 3001 (proxied through Nginx)

## 1. Frontend Build & Debug

- **Development Build (Vite):**
  - Ports are automatically configured via `config/ports.js`
  - Run dev server:
    ```bash
    npm run dev
    ```
    - Serves on port **3000** (configured in `vite.config.ts`)
    - Backend API calls go to port **3001**

- **Production Build (Vite):**
  - Environment variables are managed through `.env` files
  - Build:
    ```bash
    npm run build
    ```
    - Output: `dist` folder (static files)
    - Served by Nginx on ports 80/443

- **Preview Build:**
  - Preview production build locally:
    ```bash
    npm run preview
    ```
    - Serves on port **4173** (configured in `vite.config.ts`)

- **Port Configuration Commands:**
  ```bash
  # Show current port configuration
  make show-ports

  # Validate port configuration
  make validate-ports

  # Check for port conflicts
  make check-port-conflicts
  ```

## 2. Backend Debug

- **Start backend (pm2):**
  ```bash
  pm2 start ecosystem.config.cjs
  ```
- **View logs:**
  ```bash
  pm2 logs kimiya-voice-backend
  ```
- **Restart backend:**
  ```bash
  pm2 restart kimiya-voice-backend
  ```
- **Check health:**
  ```bash
  curl http://localhost:3001/api/health/
  ```
- **Diagnostic script:**
  ```bash
  node utils/debug-backend.js
  ```

## 3. Nginx Configuration (Example for Custom Debug Build)

```nginx
server {
    listen 5000;
    server_name localhost;

    location / {
        root /var/www/kimiya-voice/dist-dev;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```
- Reload nginx:
  ```bash
  sudo systemctl reload nginx
  ```

## 4. Tips

- Use separate environment files for dev, prod, and debug builds.
- Use `--outDir` to keep debug and prod builds separate.
- Serve debug build on a custom port for backend debugging.
- Always update backend `.env` with correct credentials.
- Use pm2 and nginx for process and static file management.
