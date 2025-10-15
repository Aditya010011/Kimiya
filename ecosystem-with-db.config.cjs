// Kimiya Voice PM2 Configuration with Database Environment Variables
const { getPort } = require('./config/ports.cjs');

// Get environment
const environment = process.env.NODE_ENV || 'development';

// Get backend port from centralized configuration
let backendPort = 3010; // development port
try {
  backendPort = getPort('backend.api', environment);
} catch (error) {
  console.warn(`⚠️  Could not get backend port from config: ${error.message}. Using fallback: ${backendPort}`);
}

console.log(`🔧 PM2 Configuration for ${environment} environment`);
console.log(`📍 Backend API Port: ${backendPort}`);

module.exports = {
  apps: [{
    name: `kimiya-voice-backend-dev`,
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice-dev',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: backendPort,
      // Database Configuration
      DB_SERVER: 'developmentdbpool.database.windows.net',
      DB_DATABASE: 'AI_Phone',
      DB_USER: 'kimiya_admin',
      DB_PASSWORD: 'KimiyaVoice@2024!',
      DB_ENCRYPT: 'true',
      DB_TRUST_SERVER_CERTIFICATE: 'false',
      DB_PORT: '1433',
      // JWT Configuration
      JWT_SECRET: 'kimiya-voice-jwt-secret-key-2024',
      // Placeholder API Keys (replace with actual values)
      AZURE_OPENAI_API_KEY: 'placeholder',
      AZURE_OPENAI_ENDPOINT: 'https://placeholder.openai.azure.com',
      TWILIO_ACCOUNT_SID: 'placeholder',
      TWILIO_AUTH_TOKEN: 'placeholder',
      WEBHOOK_BASE_URL: 'https://dev-ai-phone-call.kimiyi.ai'
    },
    error_file: './backend/logs/err.log',
    out_file: './backend/logs/out.log',
    log_file: './backend/logs/combined.log',
    time: true,
    watch: true,
    watch_delay: 1000,
    ignore_watch: ['node_modules', 'logs', 'dist', '.git'],
    max_memory_restart: '500M'
  }]
};
