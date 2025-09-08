// Kimiya Voice PM2 Configuration - Staging Environment
// Uses centralized port configuration system

const { getPort, displayPortConfig } = require('../ports.cjs');

const environment = 'staging';

// Get backend port from centralized configuration
let backendPort = 3002; // fallback for staging
try {
  backendPort = getPort('backend.api', environment);
} catch (error) {
  console.warn(`⚠️  Could not get backend port from config: ${error.message}. Using fallback: ${backendPort}`);
}

console.log(`🔧 PM2 Staging Configuration`);
console.log(`📍 Backend API Port: ${backendPort}`);
displayPortConfig(environment);

module.exports = {
  apps: [{
    name: 'kimiya-voice-backend-staging',
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice-dev,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'staging',
      PORT: backendPort
    },
    error_file: './backend/logs/staging-err.log',
    out_file: './backend/logs/staging-out.log',
    log_file: './backend/logs/staging-combined.log',
    time: true,
    watch: false,
    max_memory_restart: '750M',
    restart_delay: 2000,
    max_restarts: 5,
    min_uptime: '30s'
  }]
};
