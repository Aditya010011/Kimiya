/**
 * Twilio Voice Token Generator for Web-based Calling
 * 
 * Generates access tokens for Twilio Voice SDK to enable web-based calling
 */

const twilio = require('twilio');
const { setDynamicCorsHeaders } = require('../utils/cors-config');

/**
 * Generate Twilio Voice access token for web calling
 */
async function generateVoiceToken(req, res) {
  try {
    // Set CORS headers
    const environment = process.env.NODE_ENV || 'development';
    setDynamicCorsHeaders(req, res, environment);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('🎫 Generating Twilio Voice token...');

    // Get Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    console.log('🔍 Debug - Credentials check:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasTwimlApp: !!process.env.TWILIO_TWIML_APP_SID,
      accountSidPrefix: accountSid ? accountSid.substring(0, 6) + '...' : 'missing',
      twimlAppSidPrefix: process.env.TWILIO_TWIML_APP_SID ? process.env.TWILIO_TWIML_APP_SID.substring(0, 6) + '...' : 'missing',
      nodeEnv: process.env.NODE_ENV,
      envKeys: Object.keys(process.env).filter(key => key.startsWith('TWILIO_'))
    });

    if (!accountSid || !authToken) {
      return res.status(500).json({
        success: false,
        error: 'Twilio credentials not configured'
      });
    }

    // For JWT token generation, we need to use API Keys or Account SID properly
    // If API Keys are available, use them (recommended for production)
    // Otherwise, use Account SID as both issuer and signing key (for development)
    const keyToUse = apiKey || accountSid;
    const secretToUse = apiSecret || authToken;

    // Get identity from request (user ID or session ID)
    const identity = req.body.identity || req.query.identity || `user_${Date.now()}`;
    const workflowId = req.body.workflowId || req.query.workflowId || 'default-inbound';

    console.log('🔑 Token request:', { identity, workflowId });
    console.log('🔐 Token signing credentials:', {
      usingApiKey: !!apiKey,
      keyType: apiKey ? 'API_KEY' : 'ACCOUNT_SID',
      keyPrefix: keyToUse ? keyToUse.substring(0, 6) + '...' : 'missing',
      hasSecret: !!secretToUse
    });

    // Create access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const accessToken = new AccessToken(accountSid, keyToUse, secretToUse, {
      identity: identity,
      ttl: 3600 // 1 hour
    });

    // Create Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID, // Required for web-based calling
      incomingAllow: true, // Allow incoming calls
    });

    // Add the grant to the token
    accessToken.addGrant(voiceGrant);

    // Generate the token
    const token = accessToken.toJwt();

    console.log('✅ Voice token generated successfully');

    res.json({
      success: true,
      token: token,
      identity: identity,
      workflowId: workflowId,
      config: {
        accountSid: accountSid,
        // Don't send sensitive credentials to frontend
      }
    });

  } catch (error) {
    console.error('❌ Failed to generate voice token:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate voice token',
      details: error.message
    });
  }
}

/**
 * Handle outgoing call from web client
 */
async function handleOutgoingCall(req, res) {
  try {
    // Set proper headers for TwiML
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    console.log('📞 Outgoing call from web client');
    console.log('Request body:', req.body);

    // Extract parameters
    const to = req.body.To || req.query.To;
    const from = req.body.From || req.query.From;
    const workflowId = req.body.workflowId || req.query.workflowId || 'web-test';

    console.log('Call parameters:', { to, from, workflowId });

    // Use ConversationRelay for web calls to enable proper speech processing
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai';
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');

    // Generate unique tracking ID for this call
    const trackingId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create WebSocket URL with proper parameters
    const websocketUrl = `${wsUrl}/api/conversationrelay-ws?workflowId=${encodeURIComponent(workflowId)}&trackingId=${trackingId}&source=web-call`;

    // Encode & characters for XML safety
    const encodedWebsocketUrl = websocketUrl.replace(/&/g, '&amp;');

    console.log('🔗 Using ConversationRelay WebSocket:', websocketUrl);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay
            url="${encodedWebsocketUrl}"
            welcomeGreeting="Hello! I'm your Kimiya Voice AI assistant. How can I help you today?"
            ttsProvider="Google"
            voice="en-US-Journey-O"
            language="en-US"
        />
    </Connect>
</Response>`;

    console.log('✅ Using ConversationRelay for web call');
    res.status(200).send(twiml);

  } catch (error) {
    console.error('❌ Outgoing call error:', error.message);

    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">
        Sorry, there was an error connecting your call. Please try again.
    </Say>
    <Hangup/>
</Response>`;

    res.status(200).send(errorTwiml);
  }
}

/**
 * Create web call session for tracking
 */
async function createWebCallSession(req, res) {
  try {
    // Set CORS headers
    const environment = process.env.NODE_ENV || 'development';
    setDynamicCorsHeaders(req, res, environment);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const {
      identity,
      workflowId,
      workflowName,
      testScenario,
      browserInfo
    } = req.body;

    console.log('🌐 Creating web call session:', { identity, workflowId, testScenario });

    // Generate session ID
    const sessionId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get client IP
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    // Store session in database (if needed)
    // For now, we'll just return the session info
    const sessionData = {
      sessionId,
      identity,
      workflowId: workflowId || 'default-inbound',
      workflowName: workflowName || 'Default Inbound Workflow',
      testScenario: testScenario || 'general-test',
      browserInfo: browserInfo || {},
      ipAddress,
      status: 'initiated',
      createdAt: new Date().toISOString()
    };

    console.log('✅ Web call session created:', sessionId);

    res.json({
      success: true,
      session: sessionData
    });

  } catch (error) {
    console.error('❌ Failed to create web call session:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create web call session',
      details: error.message
    });
  }
}

/**
 * Get Twilio configuration for frontend
 */
async function getTwilioConfig(req, res) {
  try {
    // Set CORS headers
    const environment = process.env.NODE_ENV || 'development';
    setDynamicCorsHeaders(req, res, environment);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const config = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twimlAppSid: process.env.TWILIO_TWIML_APP_SID || '',
      // Don't expose sensitive credentials
      hasCredentials: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      hasApiKey: !!(process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET),
      hasTwimlApp: !!process.env.TWILIO_TWIML_APP_SID,
      region: process.env.TWILIO_REGION || 'us1',
      edge: process.env.TWILIO_EDGE || 'sydney' // Can be changed based on location
    };

    res.json({
      success: true,
      config: config
    });

  } catch (error) {
    console.error('❌ Failed to get Twilio config:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get Twilio configuration'
    });
  }
}

/**
 * Test Twilio connectivity
 */
async function testTwilioConnection(req, res) {
  try {
    // Set CORS headers
    const environment = process.env.NODE_ENV || 'development';
    setDynamicCorsHeaders(req, res, environment);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('🧪 Testing Twilio connection...');

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.json({
        success: false,
        error: 'Twilio credentials not configured',
        tests: {
          credentials: false,
          account: false,
          applications: false
        }
      });
    }

    const client = twilio(accountSid, authToken);
    const tests = {
      credentials: true,
      account: false,
      applications: false,
      twimlApp: false
    };

    try {
      // Test account access
      const account = await client.api.accounts(accountSid).fetch();
      tests.account = true;
      console.log('✅ Account access verified:', account.friendlyName);

      // Test applications list
      const applications = await client.applications.list({ limit: 20 });
      tests.applications = true;
      console.log('✅ Applications access verified:', applications.length, 'apps found');

      // Check if our TwiML App exists
      const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
      if (twimlAppSid) {
        const ourApp = applications.find(app => app.sid === twimlAppSid);
        tests.twimlApp = !!ourApp;
        if (ourApp) {
          console.log('✅ TwiML Application found:', ourApp.friendlyName);
        } else {
          console.log('⚠️ TwiML Application not found with SID:', twimlAppSid);
        }
      } else {
        console.log('⚠️ No TwiML Application SID configured');
      }

    } catch (testError) {
      console.warn('⚠️ Some Twilio tests failed:', testError.message);
    }

    const allTestsPassed = Object.values(tests).every(test => test === true);

    res.json({
      success: allTestsPassed,
      message: allTestsPassed ? 'All Twilio tests passed' : 'Some tests failed',
      tests: tests,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Twilio connection test failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Twilio connection test failed',
      details: error.message,
      tests: {
        credentials: false,
        account: false,
        applications: false
      }
    });
  }
}

module.exports = {
  generateVoiceToken,
  handleOutgoingCall,
  createWebCallSession,
  getTwilioConfig,
  testTwilioConnection
};
