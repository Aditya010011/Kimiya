const { getActiveOrchestrator, getCallMetadata } = require('./make-call-optimized');

/**
 * Fast TwiML Optimized Handler - Prevents Timeout Issues
 * Generates TwiML immediately without heavy processing to avoid 15s timeout
 *
 * Supports both direct URL calls (with query params) and TwiML App calls (using CallSid lookup)
 */
module.exports = async function twimlOptimizedHandler(req, res) {
  const startTime = performance.now();

  try {
    // Set proper headers for TwiML immediately
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const callSid = req.body.CallSid || req.query.CallSid;

    // Try to get metadata from query params first (direct URL calls)
    let workflowId = req.query.id;
    let trackingId = req.query.trackingId;
    let workflowData = null;

    // If not in query params, try to get from CallSid lookup (TwiML App calls)
    if (!trackingId && callSid) {
      const metadata = getCallMetadata(callSid);
      if (metadata) {
        workflowId = metadata.workflowId;
        trackingId = metadata.trackingId;
        workflowData = metadata.workflowData;
        console.log(`[TwiML-Optimized] Retrieved metadata from CallSid: ${callSid}`);
        console.log(`[TwiML-Optimized] Workflow data available: ${!!workflowData}`);
      }
    }

    // Fallback to defaults if still not found
    workflowId = workflowId || 'default';
    trackingId = trackingId || 'default';

    console.log(`[TwiML-Optimized] ===== FAST TWIML REQUEST =====`);
    console.log(`[TwiML-Optimized] Call: ${callSid}, Workflow: ${workflowId}, Tracking: ${trackingId}`);

    // FAST PATH: Generate TwiML immediately without heavy processing
    // The actual conversation processing will happen in the WebSocket handler
    const fastTwiML = generateFastTwiML(workflowId, trackingId, workflowData);
    
    const processingTime = performance.now() - startTime;
    console.log(`[TwiML-Optimized] FAST TwiML generated in ${processingTime.toFixed(2)}ms`);
    
    // Send response immediately to prevent timeout
    res.status(200).send(fastTwiML);
    
    // Optional: Initialize orchestrator in background (non-blocking)
    setImmediate(() => {
      try {
        const orchestrator = getActiveOrchestrator(trackingId);
        if (orchestrator) {
          console.log(`[TwiML-Optimized] Background orchestrator ready for ${trackingId}`);
        }
      } catch (error) {
        console.error(`[TwiML-Optimized] Background orchestrator error:`, error);
      }
    });

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error(`[TwiML-Optimized] Error after ${processingTime.toFixed(2)}ms:`, error);
    
    // Fast fallback
    return generateFastFallbackTwiML(req, res);
  }
};

/**
 * Escape XML special characters to prevent XML injection
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extract welcome greeting from workflow data
 * Priority: Start node's firstMessage > Global prompt context > Default greeting
 */
function extractWelcomeGreeting(workflowData) {
  try {
    // 1. Try to get firstMessage from start node
    if (workflowData && workflowData.nodes && Array.isArray(workflowData.nodes)) {
      const startNode = workflowData.nodes.find(node =>
        node.type === 'startNode' ||
        node.type === 'start' ||
        node.id === 'start' ||
        node.data?.isStartNode === true
      );

      if (startNode && startNode.data) {
        // Check for firstMessage field
        if (startNode.data.firstMessage && startNode.data.firstMessage.trim()) {
          console.log(`[extractWelcomeGreeting] Using start node's firstMessage`);
          return startNode.data.firstMessage.trim();
        }

        // Check for message field (alternative naming)
        if (startNode.data.message && startNode.data.message.trim()) {
          console.log(`[extractWelcomeGreeting] Using start node's message`);
          return startNode.data.message.trim();
        }

        // Check for welcomeMessage field (alternative naming)
        if (startNode.data.welcomeMessage && startNode.data.welcomeMessage.trim()) {
          console.log(`[extractWelcomeGreeting] Using start node's welcomeMessage`);
          return startNode.data.welcomeMessage.trim();
        }
      }
    }

    // 2. Try to use global prompt to create a contextual greeting
    if (workflowData && workflowData.globalPrompt && workflowData.globalPrompt.trim()) {
      console.log(`[extractWelcomeGreeting] Using global prompt context for greeting`);
      // Create a simple greeting that acknowledges the AI's role from global prompt
      return "Hello! I'm your AI assistant. How can I help you today?";
    }

    // 3. Fall back to default greeting
    console.log(`[extractWelcomeGreeting] Using default greeting`);
    return "Hello! I'm your Kimiya AI assistant. How can I help you today?";

  } catch (error) {
    console.error(`[extractWelcomeGreeting] Error extracting greeting:`, error);
    return "Hello! I'm your Kimiya AI assistant. How can I help you today?";
  }
}

// Fast TwiML generation functions
function generateFastTwiML(workflowId, trackingId, workflowData = null) {
  console.log(`[generateFastTwiML] ===== CREATING TWIML =====`);
  console.log(`[generateFastTwiML] Workflow: ${workflowId}, Tracking: ${trackingId}`);

  // Get host for WebSocket URL
  const host = process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai';
  const wsUrl = host.replace('https://', 'wss://').replace('http://', 'ws://');

  // CRITICAL: Include all necessary parameters for ConversationRelay
  const websocketUrl = `${wsUrl}/api/conversationrelay-ws?workflowId=${workflowId}&trackingId=${trackingId}`;

  console.log(`[generateFastTwiML] WebSocket URL: ${websocketUrl}`);

  // CRITICAL: Encode & in URL parameters to prevent XML parsing errors
  const encodedWebsocketUrl = websocketUrl.replace(/&/g, '&amp;');

  // Extract dynamic welcome greeting from workflow data
  const welcomeGreeting = extractWelcomeGreeting(workflowData);
  console.log(`[generateFastTwiML] Welcome Greeting: "${welcomeGreeting}"`);

  // Escape XML special characters in the greeting to prevent XML injection
  const escapedGreeting = escapeXml(welcomeGreeting);

  // ConversationRelay - Using Google TTS with dynamic greeting
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay
            url="${encodedWebsocketUrl}"
            welcomeGreeting="${escapedGreeting}"
            ttsProvider="Google"
            voice="en-US-Journey-O"
            language="en-US"
        />
    </Connect>
</Response>`;

  console.log(`[generateFastTwiML] ===== TWIML GENERATED =====`);
  console.log(`[generateFastTwiML] TwiML length: ${twiml.length} chars`);
  console.log(`[generateFastTwiML] WebSocket URL encoded: ${encodedWebsocketUrl}`);
  console.log(`[generateFastTwiML] ACTUAL TWIML CONTENT:`);
  console.log(twiml);

  return twiml;
}

function generateFastFallbackTwiML(req, res) {
  console.log('[generateFastFallbackTwiML] Creating emergency fallback TwiML');

  const workflowId = req.query.id || 'fallback';
  const trackingId = req.query.trackingId || 'emergency';

  // Set headers
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  // Generate emergency ConversationRelay TwiML
  const host = process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai';
  const wsUrl = host.replace('https://', 'wss://').replace('http://', 'ws://');
  const websocketUrl = `${wsUrl}/api/conversationrelay-ws?workflowId=${workflowId}&trackingId=${trackingId}`;

  const connectActionUrl = `/api/connect-action?workflowId=${workflowId}&amp;trackingId=${trackingId}`;
  const encodedWebsocketUrl = websocketUrl.replace(/&/g, '&amp;');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Emergency Fallback ConversationRelay TwiML - ElevenLabs TTS -->
    <Connect action="${connectActionUrl}">
        <ConversationRelay
            url="${encodedWebsocketUrl}"
            welcomeGreeting="Hello! I'm your AI assistant. How can I help you today?"
            voice="pNInz6obpgDQGcFmaJgB"
            language="en-US"
            dtmfDetection="true"
        />
    </Connect>
</Response>`;

  console.log('[generateFastFallbackTwiML] Sending emergency fallback TwiML');
  res.status(200).send(twiml);
}
