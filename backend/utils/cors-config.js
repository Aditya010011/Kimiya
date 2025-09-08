/**
 * Centralized CORS Configuration for Kimiya Voice Dual Environment Setup
 * 
 * This utility provides consistent CORS handling across all environments
 * and endpoints, supporting both production and development setups.
 */

/**
 * Get all allowed origins for the current environment
 * @param {string} environment - Current environment (development, staging, production)
 * @returns {Array} Array of allowed origin URLs
 */
function getAllowedOrigins(environment = process.env.NODE_ENV || 'development') {
  const baseOrigins = [
    // Production origins
    'https://ai-phone-call.kimiyi.ai',
    'http://ai-phone-call.kimiyi.ai',
    
    // Server IP origins (both HTTP and HTTPS)
    'http://20.255.99.49',
    'http://20.255.99.49:8080',
    'http://20.255.99.49:8443',
    'https://20.255.99.49',
    'https://20.255.99.49:8080',
    'https://20.255.99.49:8443',
    
    // Development origins - all possible ports
    'http://localhost:3000',  // Development frontend (Vite)
    'http://localhost:3001',  // Production backend
    'http://localhost:3010',  // Development backend
    'http://localhost:8080',  // Development HTTP
    'http://localhost:8081',  // VSCode port forwarding (8080 → 8081)
    'http://localhost:8443',  // Development HTTPS
    'https://localhost:3000', // HTTPS variants
    'https://localhost:3001',
    'https://localhost:3010',
    'https://localhost:8080',
    'https://localhost:8081', // VSCode port forwarding HTTPS
    'https://localhost:8443',

    // Additional development ports
    'http://localhost:4173',  // Vite preview
    'http://localhost:5173',  // Alternative Vite port
    'https://localhost:4173',
    'https://localhost:5173',
    
    // VM internal access
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3010',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8443',
    
    // Legacy/compatibility origins
    'https://kimiya-ai.vercel.app',
    'http://kimiya-ai.vercel.app'
  ];

  // Add environment-specific origins
  if (environment === 'development') {
    baseOrigins.push(
      'http://dev.ai-phone-call.kimiyi.ai',
      'https://dev.ai-phone-call.kimiyi.ai'
    );
  }

  return baseOrigins;
}

/**
 * Get default origin for the current environment
 * @param {string} environment - Current environment
 * @returns {string} Default origin URL
 */
function getDefaultOrigin(environment = process.env.NODE_ENV || 'development') {
  return environment === 'production' 
    ? 'https://ai-phone-call.kimiyi.ai' 
    : 'http://localhost:3000';
}

/**
 * Set dynamic CORS headers on a response object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} environment - Current environment
 */
function setDynamicCorsHeaders(req, res, environment = process.env.NODE_ENV || 'development') {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins(environment);
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', getDefaultOrigin(environment));
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name, X-HTTP-Method-Override');
  res.header('Access-Control-Allow-Credentials', 'true');
}

/**
 * Create CORS options object for express cors middleware
 * @param {string} environment - Current environment
 * @returns {Object} CORS options object
 */
function createCorsOptions(environment = process.env.NODE_ENV || 'development') {
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = getAllowedOrigins(environment);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`🚫 CORS blocked origin: ${origin} (Environment: ${environment})`);
        console.log(`✅ Allowed origins:`, allowedOrigins.slice(0, 5), '... and', allowedOrigins.length - 5, 'more');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'Accept', 
      'Origin',
      'Cache-Control',
      'X-File-Name',
      'X-HTTP-Method-Override'
    ],
    preflightContinue: false
  };
}

/**
 * Validate if an origin is allowed
 * @param {string} origin - Origin to validate
 * @param {string} environment - Current environment
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin, environment = process.env.NODE_ENV || 'development') {
  if (!origin) return true; // Allow requests with no origin
  
  const allowedOrigins = getAllowedOrigins(environment);
  return allowedOrigins.includes(origin);
}

module.exports = {
  getAllowedOrigins,
  getDefaultOrigin,
  setDynamicCorsHeaders,
  createCorsOptions,
  isOriginAllowed
};
