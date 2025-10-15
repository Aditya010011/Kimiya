/**
 * Inbound Call TwiML Handler for Kimiya Voice AI
 * 
 * Handles inbound calls using traditional TwiML approach
 * (NOT ConversationRelay - completely separate system)
 */

const inboundCallService = require('../services/InboundCallService');
const inboundWorkflowProcessor = require('../services/InboundWorkflowProcessor');
const { setDynamicCorsHeaders } = require('../utils/cors-config');

/**
 * Main inbound call handler - generates initial TwiML
 */
async function handleInboundCall(req, res) {
  const startTime = performance.now();
  
  try {
    // Set proper headers for TwiML
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Set CORS headers
    const environment = process.env.NODE_ENV || 'development';
    setDynamicCorsHeaders(req, res, environment);

    console.log('📞 ===== INBOUND CALL RECEIVED =====');
    console.log('CallSid:', req.body.CallSid);
    console.log('From:', req.body.From);
    console.log('To:', req.body.To);
    console.log('CallStatus:', req.body.CallStatus);

    // Extract call data from Twilio webhook
    const callData = {
      CallSid: req.body.CallSid,
      From: req.body.From,
      To: req.body.To,
      CallStatus: req.body.CallStatus,
      FromCity: req.body.FromCity,
      FromState: req.body.FromState,
      FromCountry: req.body.FromCountry,
      FromZip: req.body.FromZip,
      ForwardedFrom: req.body.ForwardedFrom,
      CallerName: req.body.CallerName,
      workflowId: req.query.workflowId,
      workflowName: req.query.workflowName
    };

    // Validate that workflow is provided
    if (!callData.workflowId) {
      console.error('❌ No workflow specified for inbound call');
      const errorTwiML = generateNoWorkflowTwiML();
      return res.status(200).send(errorTwiML);
    }

    // Start tracking the inbound call
    await inboundCallService.startInboundCall(callData);

    // Initialize conversation with system message
    inboundCallService.addConversationMessage(callData.CallSid, 'system',
      'Call initiated. You are Kimiya, a helpful AI voice assistant.', {
      nodeId: 'system',
      timestamp: new Date()
    });

    // Log the initial step
    await inboundCallService.logCallStep(callData.CallSid, {
      stepType: 'call_initiated',
      stepAction: 'inbound_call_received',
      processingTime: Math.round(performance.now() - startTime)
    });

    // Get workflow start node and generate TwiML
    const startNodeId = await inboundWorkflowProcessor.getWorkflowStartNode(callData.workflowId);

    // Update current node
    inboundCallService.updateCurrentNode(callData.CallSid, startNodeId);

    const twiml = await generateWorkflowTwiML(callData, startNodeId);

    const processingTime = performance.now() - startTime;
    console.log(`✅ Inbound TwiML generated in ${processingTime.toFixed(2)}ms`);

    res.status(200).send(twiml);

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error(`❌ Inbound call error after ${processingTime.toFixed(2)}ms:`, error.message);
    
    // Send fallback TwiML
    const fallbackTwiML = generateFallbackTwiML();
    res.status(200).send(fallbackTwiML);
  }
}

/**
 * Handle user input from Gather
 */
async function handleUserInput(req, res) {
  const startTime = performance.now();
  
  try {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const callSid = req.body.CallSid;
    const userInput = req.body.SpeechResult || req.body.Digits || '';
    const confidence = req.body.Confidence || null;

    console.log('🎤 User input received:', { callSid, userInput, confidence });

    // Log the user input step
    await inboundCallService.logCallStep(callSid, {
      stepType: 'user_input',
      stepAction: 'speech_or_dtmf',
      userInput: userInput,
      confidenceScore: confidence ? parseFloat(confidence) : null,
      processingTime: Math.round(performance.now() - startTime)
    });

    // Get current workflow context
    const activeCall = inboundCallService.getActiveCall(callSid);
    const workflowId = activeCall?.workflowId;

    // Validate that workflow exists for this call
    if (!workflowId) {
      console.error(`❌ No workflow found for call ${callSid}`);
      const errorTwiML = generateNoWorkflowTwiML();
      return res.status(200).send(errorTwiML);
    }

    const currentNodeId = req.query.currentNodeId || req.body.currentNodeId || activeCall?.currentStep || 'ai-response';

    // Add user input to conversation history
    if (userInput && userInput.trim()) {
      inboundCallService.addConversationMessage(callSid, 'user', userInput, {
        nodeId: currentNodeId,
        timestamp: new Date()
      });
    }

    // Get conversation history for AI context
    const conversationHistory = inboundCallService.getConversationHistory(callSid);

    // Process through workflow with conversation context
    const workflowResult = await inboundWorkflowProcessor.processWorkflowStep(
      workflowId,
      currentNodeId,
      {
        userInput,
        callSid,
        activeCall,
        conversationHistory
      }
    );

    // Add AI response to conversation history
    if (workflowResult.text && workflowResult.type === 'say') {
      inboundCallService.addConversationMessage(callSid, 'assistant', workflowResult.text, {
        nodeId: workflowResult.nodeId || currentNodeId,
        timestamp: new Date()
      });
    }

    // Update current node if specified
    if (workflowResult.nodeId) {
      inboundCallService.updateCurrentNode(callSid, workflowResult.nodeId);
    }

    // Log the workflow step
    await inboundCallService.logCallStep(callSid, {
      stepType: 'workflow_step',
      stepAction: workflowResult.type,
      userInput: userInput,
      ai_response: workflowResult.text,
      nodeId: workflowResult.nodeId || currentNodeId,
      workflowResult: workflowResult,
      processingTime: Math.round(performance.now() - startTime)
    });

    // Generate TwiML based on workflow result
    const twiml = generateWorkflowResponseTwiML(workflowResult, callSid);

    const processingTime = performance.now() - startTime;
    console.log(`✅ User input processed in ${processingTime.toFixed(2)}ms`);

    res.status(200).send(twiml);

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error(`❌ User input processing error after ${processingTime.toFixed(2)}ms:`, error.message);

    // Generate intelligent fallback response using our error handler
    const fallbackResult = handleAIError(error, callSid);
    const fallbackTwiML = generateWorkflowResponseTwiML(fallbackResult, callSid);

    res.status(200).send(fallbackTwiML);
  }
}

/**
 * Handle call status updates
 */
async function handleCallStatus(req, res) {
  try {
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;
    const duration = req.body.CallDuration ? parseInt(req.body.CallDuration) : null;
    const recordingUrl = req.body.RecordingUrl || null;

    console.log('📊 Call status update:', { callSid, callStatus, duration });

    // Update call status in service
    await inboundCallService.updateCallStatus(callSid, callStatus, {
      duration,
      recordingUrl
    });

    // If call is completed, end tracking
    if (['completed', 'failed', 'no-answer', 'busy'].includes(callStatus)) {
      await inboundCallService.endCall(callSid, { duration, recordingUrl });
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ Call status update error:', error.message);
    res.status(500).send('Error');
  }
}

/**
 * Generate welcome TwiML
 */
function generateWelcomeTwiML(callData) {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai';
  const inputUrl = `${baseUrl}/api/inbound/input?workflowId=${callData.workflowId}`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">
        Hello! Welcome to Kimiya Voice AI. I'm your intelligent assistant. 
        How can I help you today? Please speak after the tone.
    </Say>
    <Gather 
        input="speech dtmf" 
        action="${inputUrl}" 
        method="POST" 
        speechTimeout="3" 
        timeout="10"
        language="en-US"
        enhanced="true">
        <Say voice="alice" language="en-US">
            I'm listening...
        </Say>
    </Gather>
    <Say voice="alice" language="en-US">
        I didn't hear anything. Let me try again.
    </Say>
    <Redirect>${inputUrl}</Redirect>
</Response>`;
}



/**
 * Generate error TwiML when no workflow is specified
 */
function generateNoWorkflowTwiML() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">
        I'm sorry, but this call cannot be processed because no workflow has been configured.
        Please contact your system administrator to set up the proper workflow configuration.
    </Say>
    <Hangup/>
</Response>`;
}

/**
 * Generate fallback TwiML for errors
 */
function generateFallbackTwiML() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">
        Welcome to Kimiya Voice AI. I'm experiencing some technical difficulties.
        Please try calling back in a few minutes. Thank you.
    </Say>
    <Hangup/>
</Response>`;
}



/**
 * Enhanced error handling for Azure OpenAI integration
 */
function handleAIError(error, callSid) {
  console.error(`❌ AI processing error for call ${callSid}:`, error.message);

  // Log error for analytics
  inboundCallService.logCallStep(callSid, {
    stepType: 'error',
    stepAction: 'ai_processing_failed',
    error: error.message,
    processingTime: 0
  }).catch(logError => {
    console.error('❌ Failed to log AI error:', logError.message);
  });

  // Return appropriate fallback response based on error type
  if (error.message.includes('Azure OpenAI')) {
    return {
      type: 'say',
      text: "I'm experiencing some technical difficulties with my AI service. Let me try to help you in a different way. What can I assist you with?",
      nextAction: 'gather',
      gatherConfig: {
        input: 'speech dtmf',
        speechTimeout: 3,
        timeout: 10
      }
    };
  } else if (error.message.includes('timeout')) {
    return {
      type: 'say',
      text: "I'm taking a bit longer to process that. Could you please repeat your question?",
      nextAction: 'gather',
      gatherConfig: {
        input: 'speech dtmf',
        speechTimeout: 3,
        timeout: 10
      }
    };
  } else {
    return {
      type: 'say',
      text: "I'm sorry, I'm having trouble understanding. Could you please try asking something else?",
      nextAction: 'gather',
      gatherConfig: {
        input: 'speech dtmf',
        speechTimeout: 3,
        timeout: 10
      }
    };
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate workflow-based TwiML for inbound calls
 */
async function generateWorkflowTwiML(callData, startNodeId) {
  try {
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai';
    const inputUrl = `${baseUrl}/api/inbound/input`;

    if (!startNodeId) {
      // Fallback to default welcome message
      return generateWelcomeTwiML(callData);
    }

    // Get conversation history for context
    const conversationHistory = inboundCallService.getConversationHistory(callData.CallSid);

    // Process the start node through workflow
    const workflowResult = await inboundWorkflowProcessor.processWorkflowStep(
      callData.workflowId,
      startNodeId,
      {
        callData,
        isInitial: true,
        callSid: callData.CallSid,
        conversationHistory
      }
    );

    // Add initial AI response to conversation history
    if (workflowResult.text && workflowResult.type === 'say') {
      inboundCallService.addConversationMessage(callData.CallSid, 'assistant', workflowResult.text, {
        nodeId: startNodeId,
        timestamp: new Date(),
        isInitial: true
      });
    }

    return generateWorkflowResponseTwiML(workflowResult, callData.CallSid, inputUrl);

  } catch (error) {
    console.error('❌ Error generating workflow TwiML:', error.message);
    return generateWelcomeTwiML(callData);
  }
}

/**
 * Generate TwiML response based on workflow result
 */
function generateWorkflowResponseTwiML(workflowResult, callSid, inputUrl = null) {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai';
  if (!inputUrl) {
    inputUrl = `${baseUrl}/api/inbound/input`;
  }

  // Add current node ID to the input URL
  const nodeId = workflowResult.nodeId || workflowResult.nextNode || 'ai-response';
  const inputUrlWithNode = `${inputUrl}?currentNodeId=${encodeURIComponent(nodeId)}`;

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

  switch (workflowResult.type) {
    case 'say':
      twiml += `
    <Say voice="alice" language="en-US">
        ${escapeXml(workflowResult.text)}
    </Say>`;

      if (workflowResult.nextAction === 'gather' && workflowResult.gatherConfig) {
        const config = workflowResult.gatherConfig;
        twiml += `
    <Gather
        input="${config.input || 'speech dtmf'}"
        action="${inputUrlWithNode}"
        method="POST"
        speechTimeout="${config.speechTimeout || 3}"
        timeout="${config.timeout || 10}"
        language="en-US"
        enhanced="true"${config.numDigits ? ` numDigits="${config.numDigits}"` : ''}${config.finishOnKey ? ` finishOnKey="${config.finishOnKey}"` : ''}>
        <Say voice="alice" language="en-US">
            I'm listening...
        </Say>
    </Gather>`;
      }
      break;

    case 'gather':
      twiml += `
    <Say voice="alice" language="en-US">
        ${escapeXml(workflowResult.text)}
    </Say>`;

      const config = workflowResult.gatherConfig || {};
      twiml += `
    <Gather
        input="${config.input || 'speech dtmf'}"
        action="${inputUrlWithNode}"
        method="POST"
        speechTimeout="${config.speechTimeout || 3}"
        timeout="${config.timeout || 10}"
        language="en-US"
        enhanced="true"${config.numDigits ? ` numDigits="${config.numDigits}"` : ''}${config.finishOnKey ? ` finishOnKey="${config.finishOnKey}"` : ''}>
        <Say voice="alice" language="en-US">
            Please provide your input.
        </Say>
    </Gather>`;
      break;

    case 'dial':
      if (workflowResult.text) {
        twiml += `
    <Say voice="alice" language="en-US">
        ${escapeXml(workflowResult.text)}
    </Say>`;
      }
      twiml += `
    <Dial>${workflowResult.number}</Dial>`;
      break;

    case 'hangup':
      if (workflowResult.text) {
        twiml += `
    <Say voice="alice" language="en-US">
        ${escapeXml(workflowResult.text)}
    </Say>`;
      }
      twiml += `
    <Hangup/>`;
      break;

    default:
      twiml += `
    <Say voice="alice" language="en-US">
        I'm sorry, I encountered an error processing your request.
    </Say>
    <Hangup/>`;
  }

  twiml += `
</Response>`;

  return twiml;
}

module.exports = {
  handleInboundCall,
  handleUserInput,
  handleCallStatus,
  generateWorkflowTwiML,
  generateWorkflowResponseTwiML
};
