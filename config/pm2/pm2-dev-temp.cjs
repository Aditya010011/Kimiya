// Kimiya Voice PM2 Configuration - Development Environment
// Uses centralized port configuration system

const { getPort, displayPortConfig } = require('../ports.cjs');

const environment = 'development';

// Get backend port from centralized configuration
let backendPort = 3001; // fallback
try {
  backendPort = getPort('backend.api', environment);
} catch (error) {
  console.warn(`⚠️  Could not get backend port from config: ${error.message}. Using fallback: ${backendPort}`);
}

console.log(`🔧 PM2 Development Configuration`);
console.log(`📍 Backend API Port: ${backendPort}`);
displayPortConfig(environment);

module.exports = {
  apps: [{
    name: 'kimiya-voice-backend-dev',
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice-dev',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: backendPort
    },
    error_file: './backend/logs/dev-err.log',
    out_file: './backend/logs/dev-out.log',
    log_file: './backend/logs/dev-combined.log',
    time: true,
    watch: false,
    watch_delay: 1000,
    ignore_watch: ['node_modules', 'logs', 'dist', '.git', 'config/nginx/generated'],
    max_memory_restart: '500M',
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
