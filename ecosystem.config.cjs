// Kimiya Voice PM2 Configuration
// Uses centralized port configuration system

const { getPort } = require('./config/ports.cjs');

// Get environment
const environment = process.env.NODE_ENV || 'development';

// Get backend port from centralized configuration
let backendPort = 3001; // fallback
try {
  backendPort = getPort('backend.api', environment);
} catch (error) {
  console.warn(`⚠️  Could not get backend port from config: ${error.message}. Using fallback: ${backendPort}`);
}

console.log(`🔧 PM2 Configuration for ${environment} environment`);
console.log(`📍 Backend API Port: ${backendPort}`);

module.exports = {
  apps: [{
    name: `kimiya-voice-backend-${environment}`,
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: environment,
      PORT: backendPort
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3002
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    error_file: './backend/logs/err.log',
    out_file: './backend/logs/out.log',
    log_file: './backend/logs/combined.log',
    time: true,
    watch: environment === 'development',
    watch_delay: 1000,
    ignore_watch: ['node_modules', 'logs', 'dist', '.git'],
    max_memory_restart: environment === 'production' ? '1G' : '500M'
  }]
};
