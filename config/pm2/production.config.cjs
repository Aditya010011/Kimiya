// Kimiya Voice PM2 Configuration - Production Environment
// Uses centralized port configuration system

const { getPort, displayPortConfig } = require('../ports.cjs');

const environment = 'production';

// Get backend port from centralized configuration
let backendPort = 3001; // fallback for production
try {
  backendPort = getPort('backend.api', environment);
} catch (error) {
  console.warn(`⚠️  Could not get backend port from config: ${error.message}. Using fallback: ${backendPort}`);
}

console.log(`🔧 PM2 Production Configuration`);
console.log(`📍 Backend API Port: ${backendPort}`);
displayPortConfig(environment);

module.exports = {
  apps: [{
    name: 'kimiya-voice-backend',
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice-dev,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: backendPort
    },
    error_file: './backend/logs/err.log',
    out_file: './backend/logs/out.log',
    log_file: './backend/logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 3,
    min_uptime: '60s',
    kill_timeout: 5000
  }]
};
