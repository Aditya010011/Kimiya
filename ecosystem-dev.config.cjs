// Kimiya Voice PM2 Configuration - Development Environment
// Manages both frontend (Vite) and backend (Node.js) processes
// This configuration ensures both services run persistently and auto-restart on failure

const { getPort } = require('./config/ports.cjs');

// Get environment
const environment = 'development';

// Get ports from centralized configuration
let backendPort = 3010;
let frontendPort = 3000;

try {
  backendPort = getPort('backend.api', environment);
  frontendPort = getPort('frontend.dev', environment);
} catch (error) {
  console.warn(`⚠️  Could not get ports from config: ${error.message}`);
  console.warn(`Using fallback ports - Backend: ${backendPort}, Frontend: ${frontendPort}`);
}

console.log(`🔧 PM2 Configuration for ${environment} environment`);
console.log(`📍 Backend API Port: ${backendPort}`);
console.log(`📍 Frontend Dev Port: ${frontendPort}`);

module.exports = {
  apps: [
    // Backend API Server
    {
      name: 'kimiya-voice-backend-dev',
      script: './backend/server.js',
      cwd: '/var/www/kimiya-voice-dev',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: environment,
        PORT: backendPort
      },
      error_file: './backend/logs/err.log',
      out_file: './backend/logs/out.log',
      log_file: './backend/logs/combined.log',
      time: true,
      watch: false, // Disabled to prevent port conflicts during restart
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', 'dist', 'dist-dev', '.git', 'public'],
      max_memory_restart: '500M',
      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: 10000, // 10 seconds in milliseconds
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000, // Increased to 10 seconds
      // Logging
      merge_logs: false,
      // Environment-specific settings
      env_development: {
        NODE_ENV: 'development',
        PORT: backendPort
      }
    },

    // Frontend Vite Development Server
    {
      name: 'kimiya-voice-frontend-dev',
      script: 'npm',
      args: 'run dev',
      cwd: '/var/www/kimiya-voice-dev',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: environment,
        VITE_PORT: frontendPort
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      watch: false, // Vite handles its own file watching
      max_memory_restart: '500M',
      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: 10000, // 10 seconds in milliseconds
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000, // Increased to 10 seconds
      // Logging
      merge_logs: false,
      // Environment-specific settings
      env_development: {
        NODE_ENV: 'development',
        VITE_PORT: frontendPort
      }
    }
  ],

  // Global settings
  deploy: {
    development: {
      user: 'azureuser',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/kimiya-voice.git',
      path: '/var/www/kimiya-voice-dev',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem-dev.config.cjs --env development'
    }
  }
};

