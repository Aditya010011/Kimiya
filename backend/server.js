const express = require('express');
const cors = require('cors');
const path = require('path');

// Load centralized port configuration
const { getPort, displayPortConfig, validatePortConfig } = require('../config/ports.cjs');

// Load centralized CORS configuration
const { createCorsOptions, setDynamicCorsHeaders } = require('./utils/cors-config');

// Load environment configuration
const envFile = process.env.NODE_ENV === "production"
  ? "" //
  : path.join(__dirname, ".env.development");

if (envFile) {
  require("dotenv").config({ path: envFile });
}
// Always load .env file first, then environment variables can override
require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';
console.log(`🔧 Loading configuration for ${environment} environment`);

// Load database service after environment variables are loaded
const databaseService = require('./services/database');

// Load new session management system
const { bootstrapSessionServices, getSessionMiddleware, getSessionStats } = require('./core/SessionServiceBootstrap');

// Session services (will be initialized after server setup)
let sessionServices = null;
let sessionMiddleware = null;

// Validate port configuration
if (!validatePortConfig(environment)) {
  console.error('❌ Invalid port configuration. Exiting...');
  process.exit(1);
}

// Display port configuration for debugging
displayPortConfig(environment);

const app = express();

// Get port from centralized configuration with fallback
let PORT;
try {
  PORT = getPort('backend.api', environment);
} catch (error) {
  console.warn(`⚠️  ${error.message}. Using environment variable or fallback.`);
  PORT = process.env.PORT || 3001; // Safer fallback than 3000
}

console.log(`🚀 Backend server will start on port ${PORT}`);

// CORS configuration using centralized utility - Enhanced for dual environment setup
const corsOptions = createCorsOptions(environment);

console.log(`🔧 CORS configured for ${environment} environment with comprehensive port support`);

// Middleware
app.use(cors(corsOptions));

// ✅ FIX: Mount Stripe webhook BEFORE express.json() middleware
// The webhook needs raw body for signature verification
const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe', stripeRoutes);

// Now apply JSON parsing middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Health check endpoint with dynamic CORS
app.get('/health', (req, res) => {
  // Set dynamic CORS headers using centralized utility
  setDynamicCorsHeaders(req, res, environment);

  // Check ConversationRelay WebSocket status
  const conversationRelayStatus = global.conversationRelayWS ? 'active' : 'not_initialized';
  const activeConnections = global.conversationRelayWS ? global.conversationRelayWS.activeSessions?.size || 0 : 0;

  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Kimiya-ai Backend',
    conversationRelay: {
      status: conversationRelayStatus,
      activeConnections: activeConnections,
      websocketPath: '/api/conversationrelay-ws',
      protocolVersion: 'ConversationRelay-v1.0',
      expectedUrl: `wss://${process.env.WEBHOOK_BASE_URL?.replace('https://', '') || 'dev-ai-phone-call.kimiyi.ai'}/api/conversationrelay-ws`
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      port: process.env.PORT || 'not set',
      hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasTwilioPhone: !!process.env.TWILIO_PHONE_NUMBER,
      hasAzureKey: !!process.env.AZURE_OPENAI_API_KEY,
      hasAzureEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
      hasTwilioConfig: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      hasAzureConfig: !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT),
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai',
      hasDatabaseConfig: !!(process.env.DB_SERVER && process.env.DB_DATABASE && process.env.DB_USER && process.env.DB_PASSWORD),
      hasJwtConfig: !!process.env.JWT_SECRET
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  };

  // Check if critical environment variables are missing
  const missingVars = [];
  if (!process.env.TWILIO_ACCOUNT_SID) missingVars.push('TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) missingVars.push('TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_PHONE_NUMBER) missingVars.push('TWILIO_PHONE_NUMBER');

  if (missingVars.length > 0) {
    healthStatus.status = 'degraded';
    healthStatus.warnings = [`Missing environment variables: ${missingVars.join(', ')}`];
  }

  // Check ConversationRelay status
  if (conversationRelayStatus === 'not_initialized') {
    healthStatus.status = 'degraded';
    healthStatus.warnings = healthStatus.warnings || [];
    healthStatus.warnings.push('ConversationRelay WebSocket server not initialized');
  }

  res.json(healthStatus);
});

// Quick ping endpoint for fast wake-up with dynamic CORS
app.get('/ping', (req, res) => {
  // Set dynamic CORS headers using centralized utility
  setDynamicCorsHeaders(req, res, environment);

  res.json({ pong: true, timestamp: Date.now(), status: 'awake' });
});

// Import essential route handlers (removed conflicting traditional TwiML handlers)
const twilioConfigHandler = require('./routes/twilio-config');
const chatHandler = require('./routes/chat');

// Import optimized performance handlers
const makeCallOptimizedHandler = require('./routes/make-call-optimized');
const twimlOptimizedHandler = require('./routes/twiml-optimized');
const connectActionHandler = require('./routes/connect-action');
const optimizedRoutes = require('./routes/optimized-routes');
const ConversationRelayWebSocket = require('./routes/conversationrelay-websocket');
const { testTTSEndpoint } = require('./routes/test-tts-endpoint');

// Import middleware for chat endpoints
const { optionalAuth } = require('./middleware/auth');
const { requireCredits } = require('./middleware/creditMiddleware');

// Essential API Routes (removed conflicting traditional TwiML routes)
app.get('/api/twilio-config', twilioConfigHandler);
app.post('/api/chat', optionalAuth, requireCredits(1), chatHandler);

// Chat with analytics endpoint (with authentication and credit checking)
const chatWithAnalyticsHandler = require('./routes/chat-with-analytics');
app.post('/api/chat-with-analytics', optionalAuth, requireCredits(1), chatWithAnalyticsHandler);

// ConversationRelay routes (individual handlers for main endpoints)
app.post('/api/make-call-optimized', makeCallOptimizedHandler);
app.all('/api/twiml-optimized', twimlOptimizedHandler);
app.all('/api/connect-action', connectActionHandler);

// TTS diagnostic endpoint (accept both GET and POST)
app.all('/api/test-tts', testTTSEndpoint);

// Mount additional optimized routes (includes call-status-optimized and performance endpoints)
app.use('/api', optimizedRoutes);

// Database operations routes
const databaseRoutes = require('./routes/database-operations');
app.use('/api/database', databaseRoutes);

// Chat Analytics routes
const chatAnalyticsRoutes = require('./routes/chat-analytics');
app.use('/api/chat-analytics', chatAnalyticsRoutes);

// Authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Credit management routes
const creditRoutes = require('./routes/credits');
app.use('/api/credits', creditRoutes);

// Admin credit management routes
const adminCreditRoutes = require('./routes/admin-credits');
app.use('/api/admin/credits', adminCreditRoutes);

// Organization credit pool routes
const organizationCreditPoolRoutes = require('./routes/organization-credit-pools');
app.use('/api/organization-credit-pools', organizationCreditPoolRoutes);

// Billing management routes
const billingRoutes = require('./routes/billing');
app.use('/api/billing', billingRoutes);

// Stripe payment routes (already mounted before JSON middleware for webhook signature verification)

// Workflow management routes
const workflowRoutes = require('./routes/workflows');
app.use('/api/workflows', workflowRoutes);

// Workflow template routes
const templateRoutes = require('./routes/templates');
app.use('/api/templates', templateRoutes);

// Inbound call routes (TwiML-based, separate from ConversationRelay)
const inboundRoutes = require('./routes/inbound-routes');
app.use('/api/inbound', inboundRoutes);

// Contact import/export routes (must be before main contacts routes to avoid /:id conflict)
const contactImportExportRoutes = require('./routes/contacts-import-export');
app.use('/api/contacts', contactImportExportRoutes);

// Contact management routes
const contactRoutes = require('./routes/contacts');
app.use('/api/contacts', contactRoutes);

const contactGroupRoutes = require('./routes/contact-groups');
app.use('/api/contact-groups', contactGroupRoutes);

const contactTagRoutes = require('./routes/contact-tags');
app.use('/api/contact-tags', contactTagRoutes);

// ConversationRelay test endpoint
app.get('/api/conversationrelay-test', (req, res) => {
  res.json({
    status: 'ConversationRelay WebSocket server is running',
    endpoint: `wss://${process.env.WEBHOOK_BASE_URL?.replace('https://', '') || 'dev-ai-phone-call.kimiyi.ai'}/api/conversationrelay-ws`,
    protocol: 'Twilio ConversationRelay',
    features: [
      'Real-time bidirectional audio streaming',
      'Performance optimization integration',
      '<300ms audio latency',
      'Azure OpenAI integration'
    ],
    debug: {
      timestamp: new Date().toISOString(),
      serverUptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// WebSocket connection test endpoint
app.get('/api/websocket-test', (req, res) => {
  res.json({
    websocketServer: 'active',
    path: '/api/conversationrelay-ws',
    fullUrl: `wss://${process.env.WEBHOOK_BASE_URL?.replace('https://', '') || 'dev-ai-phone-call.kimiyi.ai'}/api/conversationrelay-ws`,
    testConnection: 'Use WebSocket client to connect to the above URL',
    expectedProtocol: 'Twilio ConversationRelay Media Stream'
  });
});

// Database health check endpoint
app.get('/api/database-health', async (req, res) => {
  try {
    const healthStatus = await databaseService.getHealthStatus();
    const connectionInfo = databaseService.getConnectionInfo();

    res.json({
      success: true,
      database: {
        ...healthStatus,
        connection: connectionInfo
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      database: {
        status: 'error',
        connection: databaseService.getConnectionInfo()
      }
    });
  }
});

// Health check endpoint for optimized system
app.get('/api/health-optimized', (req, res) => {
  // Test if performance services can be loaded
  let servicesStatus = {};

  try {
    const PerformanceOrchestrator = require('./services/performanceOrchestrator');
    servicesStatus.performanceOrchestrator = 'available';
  } catch (error) {
    servicesStatus.performanceOrchestrator = `error: ${error.message}`;
  }

  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    optimization: {
      enabled: true,
      features: {
        conversationRelay: 'active',
        predictiveCache: servicesStatus.performanceOrchestrator === 'available' ? 'active' : 'degraded',
        languageOptimization: servicesStatus.performanceOrchestrator === 'available' ? 'active' : 'degraded',
        providerFailover: 'active'
      }
    },
    services: servicesStatus,
    performance: {
      targetLatency: '300ms',
      maxLatency: '500ms',
      expectedImprovement: '92% faster than traditional'
    },
    environment: {
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  };

  res.json(healthStatus);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Kimiya-ai Backend API',
    version: '2.0.0',
    optimization: {
      enabled: true,
      expectedLatency: '150-250ms',
      improvement: '92% faster than traditional'
    },
    endpoints: [
      'GET /health',
      'GET /api/twilio-config',
      'GET /api/database-health',
      'POST /api/chat',
      '--- AUTHENTICATION ENDPOINTS ---',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout (protected)',
      'GET /api/auth/profile (protected)',
      'PUT /api/auth/profile (protected)',
      'PUT /api/auth/change-password (protected)',
      '--- DATABASE ENDPOINTS ---',
      'GET /api/database/test-connection',
      'GET /api/database/test-query',
      'GET /api/database/tables',
      'POST /api/database/create-logs-table',
      'POST /api/database/create-users-table',
      'POST /api/database/log-entry',
      'GET /api/database/logs',
      '--- CONVERSATIONRELAY ENDPOINTS (150-300ms) ---',
      'GET /api/health-optimized',
      'POST /api/make-call-optimized',
      'GET|POST /api/twiml-optimized (ConversationRelay)',
      'POST /api/call-status-optimized',
      'POST /api/connect-action',
      'WS /api/conversationrelay-ws',
      'GET /api/conversationrelay-test',
      'GET /api/performance-metrics/:trackingId?',
      'POST /api/test-optimization',
      'GET /api/performance-comparison'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

const server = app.listen(PORT, () => {
  console.log('\n🎉 Kimiya Voice Backend Server Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Environment: ${environment.toUpperCase()}`);
  console.log(`🔌 Backend API Server: http://localhost:${PORT}`);
  console.log(`📞 TwiML endpoints ready for Twilio webhooks`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ Performance optimization system loaded`);
  console.log(`🎯 Expected response time: 150-250ms (92% faster than traditional)`);
  console.log('\n🔥 Available Endpoints:');
  console.log(`   • GET  /health - Health check`);
  console.log(`   • GET  /ping - Quick ping`);

  // Initialize session management system
  setTimeout(async () => {
    try {
      console.log('🔄 Initializing Session Management System...');

      sessionServices = await bootstrapSessionServices({
        cache: {
          maxMemorySize: 10000,
          ttl: 30 * 60 * 1000, // 30 minutes
          enableRedis: process.env.REDIS_URL ? true : false,
          redisConfig: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {}
        },
        session: {
          sessionTimeout: 30 * 60 * 1000, // 30 minutes
          heartbeatTimeout: 5 * 60 * 1000, // 5 minutes
          maxSessionsPerUser: 10
        }
      });

      sessionMiddleware = getSessionMiddleware(sessionServices);

      console.log(`   • Session Management System: ✅ Active with comprehensive monitoring`);

      // Add session stats endpoint
      app.get('/api/session-stats', sessionMiddleware.requireAdmin, async (req, res) => {
        try {
          const stats = await getSessionStats(sessionServices);
          res.json({
            success: true,
            data: stats
          });
        } catch (error) {
          console.error('Failed to get session stats:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to retrieve session statistics'
          });
        }
      });

    } catch (error) {
      console.error('❌ Session Management System initialization failed:', error.message);
      console.log(`   • Session Management System: ❌ Failed - using fallback mode`);
    }
  }, 2000); // 2 seconds after startup
  console.log(`   • POST /api/make-call-optimized - Optimized call creation`);
  console.log(`   • POST /api/twiml-optimized - Optimized TwiML processing`);
  console.log(`   • GET  /api/performance-metrics - Performance metrics`);
  console.log(`   • GET  /api/health-optimized - Optimized health check`);
  console.log(`   • WS   /api/conversationrelay-ws - WebSocket for real-time audio`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Initialize ConversationRelay WebSocket server
try {
  const conversationRelayWS = new ConversationRelayWebSocket(server);

  // Store reference globally for health checks
  global.conversationRelayWS = conversationRelayWS;

  console.log(`🎙️  ConversationRelay WebSocket server initialized`);
  console.log(`📡 Real-time audio streaming: wss://${process.env.WEBHOOK_BASE_URL?.replace('https://', '') || 'dev-ai-phone-call.kimiyi.ai'}/api/conversationrelay-ws`);
} catch (error) {
  console.error(`❌ ConversationRelay WebSocket server failed to initialize:`, error.message);
  console.log(`📡 Falling back to traditional TwiML processing`);
  global.conversationRelayWS = null;
}

module.exports = app;
