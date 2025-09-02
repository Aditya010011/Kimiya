module.exports = {
  apps: [{
    name: 'kimiya-voice-backend',
    script: './backend/server.js',
    cwd: '/var/www/kimiya-voice',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    error_file: './backend/logs/err.log',
    out_file: './backend/logs/out.log',
    log_file: './backend/logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
