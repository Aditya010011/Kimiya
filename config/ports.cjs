/**
 * Centralized Port Configuration System
 * 
 * This file defines all port allocations for the Kimiya Voice application
 * across different environments to prevent conflicts and ensure consistency.
 */

const PORT_CONFIG = {
  // Development Environment Ports
  development: {
    // Frontend Development Server (Vite)
    frontend: {
      dev: 3000,
      preview: 4173,
      http: 8080,
      https: 8443
    },

    // Backend API Server
    backend: {
      api: 3010,  // Development backend uses port 3010 (different from production)
      debug: 9229
    },

    // Alternative/Testing Ports
    alternative: {
      http: 8081,
      backend_alt: 3011
    }
  },

  // Staging Environment Ports
  staging: {
    // Frontend served by Nginx
    frontend: {
      http: 80,
      https: 443,
      alt_http: 8080
    },
    
    // Backend API Server
    backend: {
      api: 3002,
      debug: 9230
    }
  },

  // Production Environment Ports
  production: {
    // Frontend served by Nginx
    frontend: {
      http: 80,
      https: 443,
      alt_http: 8080
    },
    
    // Backend API Server
    backend: {
      api: 3001,
      debug: 9229 // Disabled in production
    }
  },

  // System/Infrastructure Ports
  system: {
    ssh: 22,
    nginx_http: 80,
    nginx_https: 443
  }
};
function applyOverrides(config, environment = process.env.NODE_ENV || "development") {
  const envConfig = config[environment];
  if (!envConfig) return;

  // 1) Apply environment variables
  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (!/^\d+$/.test(envVal)) continue; // only numeric ports
    // Convert BACKEND_API → backend.api
    const keyPath = envKey.toLowerCase().split("_");
    let target = envConfig;
    for (let i = 0; i < keyPath.length - 1; i++) {
      if (typeof target[keyPath[i]] === "object" && target[keyPath[i]] !== null) {
        target = target[keyPath[i]];
      } else {
        target = null;
        break;
      }
    }
    if (target) {
      const lastKey = keyPath.at(-1);
      if (Object.prototype.hasOwnProperty.call(target, lastKey)) {
        console.log(`🔄 ENV override ${envKey} → ${envVal}`);
        target[lastKey] = parseInt(envVal, 10);
      }
    }
  }

  // 2) Apply CLI args (take precedence)
  process.argv.forEach(arg => {
    const match = arg.match(/^--([a-zA-Z0-9_.]+)=(\d+)$/);
    if (match) {
      const keyPath = match[1].split(".");
      const value = parseInt(match[2], 10);

      let target = envConfig;
      for (let i = 0; i < keyPath.length - 1; i++) {
        if (typeof target[keyPath[i]] === "object" && target[keyPath[i]] !== null) {
          target = target[keyPath[i]];
        } else {
          console.warn(`⚠️ Invalid override path: ${keyPath.join(".")}`);
          return;
        }
      }

      const lastKey = keyPath[keyPath.length - 1];
      if (Object.prototype.hasOwnProperty.call(target, lastKey)) {
        console.log(`🔄 CLI override ${environment}.${keyPath.join(".")} → ${value}`);
        target[lastKey] = value;
      }
    }
  });
}
applyOverrides(PORT_CONFIG);
/**
 * Get port configuration for current environment
 * @param {string} environment - Environment name (development, staging, production)
 * @returns {object} Port configuration for the environment
 */
function getPortConfig(environment = process.env.NODE_ENV || 'development') {
  const config = PORT_CONFIG[environment];
  if (!config) {
    console.warn(`⚠️  Unknown environment: ${environment}. Falling back to development.`);
    return PORT_CONFIG.development;
  }
  return config;
}

/**
 * Get specific port for a service
 * @param {string} service - Service name (e.g., 'backend.api', 'frontend.dev')
 * @param {string} environment - Environment name
 * @returns {number} Port number
 */
function getPort(service, environment = process.env.NODE_ENV || 'development') {
  const config = getPortConfig(environment);
  const serviceParts = service.split('.');
  
  let port = config;
  for (const part of serviceParts) {
    port = port[part];
    if (port === undefined) {
      throw new Error(`❌ Port not found for service: ${service} in environment: ${environment}`);
    }
  }
  
  return port;
}

/**
 * Get backend API URL for current environment
 * @param {string} environment - Environment name
 * @returns {string} Backend API URL
 */
function getBackendUrl(environment = process.env.NODE_ENV || 'development') {
  const config = getPortConfig(environment);

  // If overridden via sys arg, use that
  if (OVERRIDDEN_BACKEND_URL) {
    return OVERRIDDEN_BACKEND_URL;
  }

  if (environment === 'development') {
    return `http://localhost:${config.backend.api}`;
  } else {
    // In staging/production, backend is proxied through nginx
    return process.env.WEBHOOK_BASE_URL || 'https://ai-phone-call.kimiyi.ai';
  }
}

/**
 * Get frontend URL for current environment
 * @param {string} environment - Environment name
 * @returns {string} Frontend URL
 */
function getFrontendUrl(environment = process.env.NODE_ENV || 'development') {
  const config = getPortConfig(environment);
  
  if (environment === 'development') {
    return `http://localhost:${config.frontend.dev}`;
  } else {
    // In staging/production, frontend is served by nginx
    return process.env.FRONTEND_URL || 'https://ai-phone-call.kimiyi.ai';
  }
}

/**
 * Validate port configuration
 * @param {string} environment - Environment to validate
 * @returns {boolean} True if configuration is valid
 */
function validatePortConfig(environment = process.env.NODE_ENV || 'development') {
  try {
    const config = getPortConfig(environment);
    
    // Check for port conflicts within environment
    const usedPorts = new Set();
    const checkPorts = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'number') {
          if (usedPorts.has(value)) {
            console.error(`❌ Port conflict: ${value} used by multiple services in ${environment}`);
            return false;
          }
          usedPorts.add(value);
        } else if (typeof value === 'object' && value !== null) {
          if (!checkPorts(value, currentPath)) {
            return false;
          }
        }
      }
      return true;
    };
    
    const isValid = checkPorts(config);
    if (isValid) {
      console.log(`✅ Port configuration valid for ${environment}`);
    }
    
    return isValid;
  } catch (error) {
    console.error(`❌ Port configuration validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Display port configuration for debugging
 * @param {string} environment - Environment to display
 */
function displayPortConfig(environment = process.env.NODE_ENV || 'development') {
  const config = getPortConfig(environment);
  console.log(`\n🔧 Port Configuration for ${environment.toUpperCase()}:`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const displayPorts = (obj, indent = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number') {
        console.log(`${indent}📍 ${key}: ${value}`);
      } else if (typeof value === 'object' && value !== null) {
        console.log(`${indent}📁 ${key}:`);
        displayPorts(value, indent + '  ');
      }
    }
  };
  
  displayPorts(config);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

module.exports = {
  PORT_CONFIG,
  getPortConfig,
  getPort,
  getBackendUrl,
  getFrontendUrl,
  validatePortConfig,
  displayPortConfig
};
