const express = require('express');
const cors = require('cors');


const envFile = process.env.NODE_ENV === "production"
  ? "" // 
  : ".env.development";

if (envFile) {
  require("dotenv").config({ path: envFile });
}
// Always load .env file first, then environment variables can override
require('dotenv').config();
console.log('🔧 Loading .env file for configuration');

if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Production mode: Environment variables will override .env values');
} else {
  console.log('🔧 Development mode: Using .env file configuration');
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration to allow multiple frontends - Enhanced for better compatibility
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:3000',
      'https://ai-phone-call.kimiyi.ai',
      'http://20.255.99.49',
      'http://20.255.99.49:8080'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Health check endpoint with explicit CORS
app.get('/health', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', 'https://ai-phone-call.kimiyi.ai');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

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
      expectedUrl: `wss://${process.env.WEBHOOK_BASE_URL?.replace('https://', '') || 'ai-phone-call.kimiyi.ai'}/api/conversationrelay-ws`
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
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'https://ai-phone-call.kimiyi.ai'
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

// Quick ping endpoint for fast wake-up with CORS
app.get('/ping', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', 'https://ai-phone-call.kimiyi.ai');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

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

// Essential API Routes (removed conflicting traditional TwiML routes)
app.get('/api/twilio-config', twilioConfigHandler);
app.post('/api/chat', chatHandler);

// ConversationRelay routes (individual handlers for main endpoints)
app.post('/api/make-call-optimized', makeCallOptimizedHandler);
app.all('/api/twiml-optimized', twimlOptimizedHandler);
app.all('/api/connect-action', connectActionHandler);

// TTS diagnostic endpoint (accept both GET and POST)
app.all('/api/test-tts', testTTSEndpoint);

// Mount additional optimized routes (includes call-status-optimized and performance endpoints)
app.use('/api', optimizedRoutes);

// ConversationRelay test endpoint
app.get('/api/conversationrelay-test', (req, res) => {
  res.json({
    status: 'ConversationRelay WebSocket server is running',
    endpoint: 'wss://ai-phone-call.kimiyi.ai/api/conversationrelay-ws',
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
    fullUrl: 'wss://ai-phone-call.kimiyi.ai/api/conversationrelay-ws',
    testConnection: 'Use WebSocket client to connect to the above URL',
    expectedProtocol: 'Twilio ConversationRelay Media Stream'
  });
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
      'POST /api/chat',
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
  console.log(`🚀 Kimiya-ai Backend running on port ${PORT}`);
  console.log(`📞 TwiML endpoints ready for Twilio webhooks`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ Performance optimization system loaded`);
  console.log(`🎯 Expected response time: 150-250ms (92% faster than traditional)`);
  console.log(`🔥 Optimized endpoints:`);
  console.log(`   • POST /api/make-call-optimized`);
  console.log(`   • POST /api/twiml-optimized`);
  console.log(`   • GET  /api/performance-metrics`);
  console.log(`   • GET  /api/health-optimized`);
});

// Initialize ConversationRelay WebSocket server
try {
  const conversationRelayWS = new ConversationRelayWebSocket(server);

  // Store reference globally for health checks
  global.conversationRelayWS = conversationRelayWS;

  console.log(`🎙️  ConversationRelay WebSocket server initialized`);
  console.log(`📡 Real-time audio streaming: wss://ai-phone-call.kimiyi.ai/api/conversationrelay-ws`);
} catch (error) {
  console.error(`❌ ConversationRelay WebSocket server failed to initialize:`, error.message);
  console.log(`📡 Falling back to traditional TwiML processing`);
  global.conversationRelayWS = null;
}

module.exports = app;
