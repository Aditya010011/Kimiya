const EventEmitter = require('events');
const StreamingAudioProcessor = require('./streamingAudioProcessor');
const PredictiveCache = require('./predictiveCache');
const LanguageOptimizer = require('./languageOptimizer');

class ConversationRelay extends EventEmitter {
  constructor(config, workflowConfig) {
    super();
    this.config = config;
    this.workflowConfig = workflowConfig;
    this.isActive = false;
    this.audioBuffer = [];
    this.sequenceNumber = 0;
    this.performanceMetrics = new PerformanceMetrics();
    this.streamProcessor = new StreamingAudioProcessor(workflowConfig);
    this.activeCalls = new Map();
    
    this.setupEventHandlers();
    console.log('[ConversationRelay] Initialized with bidirectional streaming');
  }

  async startConversation(callSid, workflowData) {
    const startTime = performance.now();

    try {
      console.log(`[ConversationRelay] Starting conversation for call ${callSid}`);
      console.log(`[ConversationRelay] Workflow data:`, {
        workflowId: workflowData.workflowId,
        nodesCount: workflowData.nodes?.length || 0,
        edgesCount: workflowData.edges?.length || 0,
        hasGlobalPrompt: !!workflowData.globalPrompt
      });

      // Find the actual start node by type instead of hardcoded 'start' string
      const startNode = this.findStartNode(workflowData.nodes);
      const startNodeId = startNode ? startNode.id : 'start';

      console.log(`[ConversationRelay] 🎯 Start node identified: ${startNodeId} (type: ${startNode?.type || 'unknown'})`);

      // Store workflow data for this call
      this.activeCalls.set(callSid, {
        workflowData,
        conversationHistory: [],
        currentNode: startNodeId,
        startTime: Date.now(),
        isActive: true
      });

      // Initialize streaming connection
      await this.initializeStream(callSid, workflowData);

      // Set up bidirectional audio processing
      await this.setupBidirectionalStreaming(callSid);

      this.isActive = true;

      const initTime = performance.now() - startTime;
      console.log(`[ConversationRelay] Conversation started in ${initTime}ms`);

      this.emit('conversationStarted', { callSid, initTime, workflowData });

    } catch (error) {
      console.error('[ConversationRelay] Failed to start conversation:', error);
      this.emit('error', { callSid, error });
      throw error;
    }
  }

  async processAudioChunk(audioChunk) {
    const processingStartTime = performance.now();
    
    try {
      // Apply real-time audio optimizations
      const optimizedAudio = await this.optimizeAudioChunk(audioChunk);
      
      // Process through streaming pipeline
      const response = await this.streamProcessor.processAudio(optimizedAudio);
      
      const processingTime = performance.now() - processingStartTime;
      
      // Update performance metrics
      this.performanceMetrics.recordProcessingTime(processingTime);
      
      // Check if we're meeting latency targets
      if (processingTime > this.config.performance.targetLatency) {
        console.warn(`[ConversationRelay] Processing time ${processingTime}ms exceeds target ${this.config.performance.targetLatency}ms`);
        this.emit('performanceWarning', { processingTime, target: this.config.performance.targetLatency });
      }
      
      const streamingResponse = {
        ...response,
        processingTime,
        language: this.workflowConfig.globalSettings?.defaultLanguage || 'en-US'
      };
      
      this.emit('audioProcessed', streamingResponse);
      
      return streamingResponse;
      
    } catch (error) {
      console.error('[ConversationRelay] Audio processing failed:', error);
      this.emit('processingError', { audioChunk, error });
      throw error;
    }
  }

  async initializeStream(callSid, workflowData) {
    // Get existing call data (set by startConversation)
    const existingCallData = this.activeCalls.get(callSid);

    if (existingCallData) {
      // Update existing call data instead of overwriting
      console.log(`[ConversationRelay] 🔄 Updating existing call data for ${callSid}`);

      // Find the actual start node
      const startNode = this.findStartNode(workflowData?.nodes);
      const startNodeId = startNode ? startNode.id : (workflowData?.nodes?.[0]?.id || 'start');

      existingCallData.messageHistory = [];
      existingCallData.currentNodeId = startNodeId;
      existingCallData.currentNode = startNodeId;
      existingCallData.conversationTurns = 0;
    } else {
      // Fallback: create new call data if it doesn't exist
      console.log(`[ConversationRelay] ⚠️  No existing call data, creating new for ${callSid}`);

      // Find the actual start node
      const startNode = this.findStartNode(workflowData?.nodes);
      const startNodeId = startNode ? startNode.id : (workflowData?.nodes?.[0]?.id || 'start');

      this.activeCalls.set(callSid, {
        workflowData,
        conversationHistory: [],
        currentNode: startNodeId,
        startTime: Date.now(),
        isActive: true,
        messageHistory: [],
        currentNodeId: startNodeId,
        conversationTurns: 0
      });
    }

    // Initialize Twilio Media Stream configuration
    const mediaStreamConfig = {
      callSid,
      track: 'both', // inbound and outbound
      statusCallback: `${process.env.WEBHOOK_BASE_URL || 'https://dev-ai-phone-call.kimiyi.ai'}/api/media-stream-status`,
      statusCallbackMethod: 'POST'
    };

    // Set up WebSocket connection for real-time audio (if available)
    await this.setupWebSocketConnection(callSid);

    // Configure audio processing pipeline
    await this.configureAudioPipeline(workflowData);

    console.log(`[ConversationRelay] Stream initialized for call ${callSid}`);
  }

  async setupBidirectionalStreaming(callSid) {
    const callData = this.activeCalls.get(callSid);
    if (!callData) {
      throw new Error(`No call data found for ${callSid}`);
    }

    // Configure inbound audio processing (user speech)
    this.on('inboundAudio', async (audioData, receivedCallSid) => {
      if (receivedCallSid !== callSid) return;
      
      const audioChunk = {
        data: audioData,
        timestamp: Date.now(),
        sequenceNumber: this.sequenceNumber++,
        language: callData.workflowData?.globalSettings?.defaultLanguage || 'en-US'
      };
      
      try {
        const response = await this.processAudioChunk(audioChunk);
        
        // Send response audio back to user
        this.sendOutboundAudio(response.audioData, callSid);
        
      } catch (error) {
        console.error('[ConversationRelay] Inbound audio processing failed:', error);
        // Send error response or fallback audio
        await this.handleProcessingError(error, callSid);
      }
    });

    // Configure outbound audio streaming (AI responses)
    this.on('outboundAudio', (audioData, receivedCallSid) => {
      if (receivedCallSid !== callSid) return;
      this.sendAudioToTwilio(audioData, callSid);
    });
    
    console.log(`[ConversationRelay] Bidirectional streaming setup complete for call ${callSid}`);
  }

  async optimizeAudioChunk(audioChunk) {
    let optimizedData = audioChunk.data;
    
    // Apply noise reduction if enabled
    if (this.config.latencyOptimization.noiseReduction) {
      optimizedData = await this.applyNoiseReduction(optimizedData);
    }
    
    // Apply echo cancellation if enabled
    if (this.config.latencyOptimization.echoCancellation) {
      optimizedData = await this.applyEchoCancellation(optimizedData);
    }
    
    // Voice activity detection
    if (this.config.latencyOptimization.voiceActivityDetection) {
      const hasVoice = await this.detectVoiceActivity(optimizedData);
      if (!hasVoice) {
        // Skip processing for silence
        return { ...audioChunk, data: Buffer.alloc(0), confidence: 0 };
      }
    }
    
    return {
      ...audioChunk,
      data: optimizedData,
      confidence: await this.calculateAudioConfidence(optimizedData)
    };
  }

  async setupWebSocketConnection(callSid) {
    // This would integrate with Twilio's Media Streams API
    // For now, we'll use the existing TwiML approach but with optimized processing
    console.log(`[ConversationRelay] WebSocket connection setup for call ${callSid} (using TwiML bridge)`);
  }

  async configureAudioPipeline(workflowData) {
    // Configure the audio processing pipeline based on language settings
    const languageConfig = workflowData?.globalSettings?.languageConfig;
    
    if (languageConfig) {
      await this.streamProcessor.configureForLanguage(languageConfig);
    }
    
    console.log('[ConversationRelay] Audio pipeline configured');
  }

  sendOutboundAudio(audioData, callSid) {
    this.emit('outboundAudio', audioData, callSid);
  }

  sendAudioToTwilio(audioData, callSid) {
    // Send audio data back to Twilio Media Stream
    // For now, this integrates with the existing TwiML system
    console.log(`[ConversationRelay] Sending ${audioData.length} bytes to Twilio for call ${callSid}`);
  }

  async handleProcessingError(error, callSid) {
    const callData = this.activeCalls.get(callSid);
    const language = callData?.workflowData?.globalSettings?.defaultLanguage || 'en-US';
    
    // Generate fallback response
    const fallbackMessage = this.getErrorMessage(language);
    const fallbackAudio = await this.streamProcessor.generateFallbackAudio(fallbackMessage);
    this.sendOutboundAudio(fallbackAudio, callSid);
  }

  getErrorMessage(language) {
    const errorMessages = {
      'en-US': "I'm sorry, I didn't catch that. Could you please repeat?",
      'zh-HK': '唔好意思，我聽唔清楚，可以再講一次嗎？',
      'zh-CN': '抱歉，我没听清楚，您能再说一遍吗？',
      'es-ES': 'Lo siento, no te he entendido. ¿Puedes repetir?',
      'fr-FR': 'Désolé, je n\'ai pas compris. Pouvez-vous répéter?'
    };
    
    return errorMessages[language] || errorMessages['en-US'];
  }

  async applyNoiseReduction(audioData) {
    // Implement noise reduction algorithm
    // This is a placeholder - you'd use a real noise reduction library
    return audioData;
  }

  async applyEchoCancellation(audioData) {
    // Implement echo cancellation
    // This is a placeholder - you'd use a real echo cancellation library
    return audioData;
  }

  async detectVoiceActivity(audioData) {
    // Implement voice activity detection
    // This is a placeholder - you'd use a real VAD algorithm
    return audioData.length > 0;
  }

  async calculateAudioConfidence(audioData) {
    // Calculate confidence score for audio quality
    // This is a placeholder - you'd implement real audio quality metrics
    return 0.95;
  }

  setupEventHandlers() {
    this.on('error', (error) => {
      console.error('[ConversationRelay] Error:', error);
      this.performanceMetrics.recordError(error);
    });

    this.on('performanceWarning', (data) => {
      console.warn('[ConversationRelay] Performance warning:', data);
      this.performanceMetrics.recordWarning(data);
    });
  }

  async stopConversation(callSid) {
    console.log(`[ConversationRelay] Stopping conversation for call ${callSid}`);
    this.isActive = false;
    
    // Clean up call data
    this.activeCalls.delete(callSid);
    
    // Clean up resources
    this.audioBuffer = [];
    this.sequenceNumber = 0;
    
    // Emit final metrics
    const metrics = this.performanceMetrics.getFinalMetrics();
    this.emit('conversationEnded', { callSid, metrics });
  }

  getPerformanceMetrics() {
    return this.performanceMetrics.getCurrentMetrics();
  }

  async endConversation(callSid) {
    console.log(`[ConversationRelay] Ending conversation for call ${callSid}`);

    const callData = this.activeCalls.get(callSid);
    if (callData) {
      callData.isActive = false;

      // Emit conversation ended event with metrics
      this.emit('conversationEnded', {
        callSid,
        duration: Date.now() - callData.startTime,
        messageCount: callData.messageCount || 0
      });

      // Clean up resources
      this.activeCalls.delete(callSid);
    }

    this.isActive = false;
  }

  async processTranscript(transcript, context) {
    // Process speech transcript with workflow awareness
    const startTime = performance.now();

    try {
      console.log(`[ConversationRelay] Processing transcript: "${transcript}" for call ${context.callSid}`);
      console.log(`[ConversationRelay] 🔍 Active calls in memory:`, Array.from(this.activeCalls.keys()));
      console.log(`[ConversationRelay] 🔍 Looking for callSid: "${context.callSid}"`);

      const callData = this.activeCalls.get(context.callSid);
      console.log(`[ConversationRelay] 🔍 Call data found:`, !!callData);

      if (!callData) {
        console.error(`[ConversationRelay] ❌ No call data found for ${context.callSid}`);
        console.error(`[ConversationRelay] ❌ Available call IDs:`, Array.from(this.activeCalls.keys()));
        throw new Error(`No call data found for ${context.callSid}`);
      }

      console.log(`[ConversationRelay] 🔍 Call data structure:`, {
        hasWorkflowData: !!callData.workflowData,
        hasConversationHistory: !!callData.conversationHistory,
        conversationHistoryType: typeof callData.conversationHistory,
        conversationHistoryLength: callData.conversationHistory?.length,
        currentNode: callData.currentNode,
        isActive: callData.isActive
      });

      // Add user message to conversation history
      callData.conversationHistory.push({
        role: 'user',
        content: transcript,
        timestamp: Date.now()
      });

      // Process through workflow logic
      const response = await this.processWorkflowLogic(transcript, callData);

      // Add assistant response to conversation history
      callData.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });

      const processingTime = performance.now() - startTime;
      console.log(`[ConversationRelay] Transcript processed in ${processingTime.toFixed(2)}ms`);

      return {
        response,
        processingTime,
        confidence: 0.95,
        workflowNode: callData.currentNode
      };

    } catch (error) {
      console.error(`[ConversationRelay] Transcript processing error:`, error);
      return {
        response: "I understand you're speaking. How can I help you?",
        processingTime: performance.now() - startTime,
        confidence: 0.5,
        error: error.message
      };
    }
  }

  async processDTMF(digit, session) {
    // Process DTMF input with workflow awareness
    try {
      console.log(`[ConversationRelay] Processing DTMF: ${digit} for call ${session.callSid}`);

      const callData = this.activeCalls.get(session.callSid);
      if (!callData) {
        return { response: `You pressed ${digit}. How can I help you?` };
      }

      // Process DTMF through workflow logic
      const response = await this.processWorkflowLogic(`DTMF:${digit}`, callData);

      return {
        response,
        digit,
        workflowNode: callData.currentNode
      };

    } catch (error) {
      console.error(`[ConversationRelay] DTMF processing error:`, error);
      return { response: `You pressed ${digit}. How can I help you further?` };
    }
  }

  async processWorkflowLogic(input, callData) {
    // Process input through workflow nodes and logic
    try {
      const { workflowData } = callData;

      console.log(`[ConversationRelay] 🎯 Processing workflow logic for input: "${input}"`);
      console.log(`[ConversationRelay] 📊 Current node: ${callData.currentNode}`);
      console.log(`[ConversationRelay] 📊 Available nodes: ${workflowData.nodes?.length || 0}`);

      // Debug: Log all node IDs to help diagnose matching issues
      if (workflowData.nodes && workflowData.nodes.length > 0) {
        const nodeIds = workflowData.nodes.map(n => `${n.id} (${n.type})`).join(', ');
        console.log(`[ConversationRelay] 📋 Node IDs in workflow: ${nodeIds}`);
      }

      // Execute workflow node logic
      const currentNode = this.findNodeById(workflowData.nodes, callData.currentNode);

      if (currentNode) {
        console.log(`[ConversationRelay] 🎯 Executing node: ${currentNode.type} (${currentNode.id})`);

        // Execute node-specific logic
        const nodeResult = await this.executeNode(currentNode, input, callData);

        // Determine next node based on edges and conditions
        const nextNode = this.determineNextNode(workflowData, currentNode, input, nodeResult);

        if (nextNode) {
          console.log(`[ConversationRelay] ➡️  Moving to next node: ${nextNode.id}`);
          callData.currentNode = nextNode.id;
        }

        return nodeResult.response;
      }

      // Fallback to AI response if no node found
      console.log(`[ConversationRelay] ⚠️  No node found with ID "${callData.currentNode}", using AI fallback`);
      console.log(`[ConversationRelay] 💡 This usually means the currentNode ID doesn't match any node in the workflow`);

      // Build conversation context with enhanced system prompt
      const systemPrompt = workflowData.globalPrompt || 'You are a helpful AI assistant. Provide concise, helpful responses.';
      const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Keep your responses brief and conversational (2-3 sentences max). You are speaking on a phone call, so be natural and concise.`;

      const messages = [
        {
          role: 'system',
          content: enhancedSystemPrompt
        }
      ];

      // Add recent conversation history
      if (callData.conversationHistory.length > 0) {
        messages.push(...callData.conversationHistory.slice(-5));
      }

      // Add current input
      messages.push({ role: 'user', content: input });

      // Generate AI response
      const response = await this.generateAIResponse(messages);

      return response;

    } catch (error) {
      console.error(`[ConversationRelay] Workflow logic error:`, error);
      return "I'm here to help. What would you like to know?";
    }
  }

  /**
   * Find the start node in the workflow
   * @param {Array} nodes - Array of workflow nodes
   * @returns {Object|null} - The start node or null
   */
  findStartNode(nodes) {
    if (!nodes || !Array.isArray(nodes)) return null;

    // Look for nodes with type 'startNode' or 'startCall'
    const startNode = nodes.find(node =>
      node.type === 'startNode' ||
      node.type === 'startCall' ||
      node.type === 'start'
    );

    if (startNode) {
      console.log(`[ConversationRelay] 🎯 Found start node: ${startNode.id} (type: ${startNode.type})`);
      return startNode;
    }

    // Fallback: return first node if no explicit start node
    if (nodes.length > 0) {
      console.log(`[ConversationRelay] ⚠️  No explicit start node found, using first node: ${nodes[0].id}`);
      return nodes[0];
    }

    return null;
  }

  findNodeById(nodes, nodeId) {
    if (!nodes || !Array.isArray(nodes)) return null;
    return nodes.find(node => node.id === nodeId);
  }

  async executeNode(node, input, callData) {
    // Execute node-specific logic based on node type
    console.log(`[ConversationRelay] 🔧 Executing node type: ${node.type}`);

    // Normalize node type to lowercase for case-insensitive matching
    const nodeType = (node.type || '').toLowerCase();

    switch (nodeType) {
      // ===== START NODE TYPES =====
      case 'startnode':
      case 'startcall':
      case 'start':
        console.log(`[ConversationRelay] 🎬 Executing start node: ${node.id}`);
        // Start node typically just initializes the conversation
        // The firstMessage is already handled by TwiML welcomeGreeting
        // So we just acknowledge and move to next node
        return {
          response: node.data?.firstMessage || "Welcome! How can I help you today?",
          action: 'speak',
          metadata: {
            nodeType: 'start',
            globalPrompt: node.data?.globalPrompt
          }
        };

      // ===== CONVERSATION NODE TYPES (AI-powered) =====
      case 'conversationnode':
      case 'ai':
      case 'llm':
        console.log(`[ConversationRelay] 🤖 Executing conversation node: ${node.id}`);

        // Build system prompt from node-specific prompt or global prompt
        const nodePrompt = node.data?.prompt || node.data?.systemPrompt || node.data?.instructions;
        const globalPrompt = callData.workflowData?.globalPrompt || 'You are a helpful AI assistant.';

        // Combine prompts: global context + node-specific instructions
        let systemPrompt = globalPrompt;
        if (nodePrompt) {
          systemPrompt = `${globalPrompt}\n\nFor this conversation step:\n${nodePrompt}`;
        }

        // Add phone call context reminder
        systemPrompt += '\n\nIMPORTANT: Keep your responses brief and conversational (2-3 sentences max). You are speaking on a phone call, so be natural and concise.';

        const conversationMessages = [
          {
            role: 'system',
            content: systemPrompt
          }
        ];

        // Add recent conversation history for context
        if (callData.conversationHistory && callData.conversationHistory.length > 0) {
          conversationMessages.push(...callData.conversationHistory.slice(-5));
        }

        // Add current user input
        conversationMessages.push({ role: 'user', content: input });

        console.log(`[ConversationRelay] 💬 Generating AI response with ${conversationMessages.length} messages`);
        const conversationResponse = await this.generateAIResponse(conversationMessages);

        return {
          response: conversationResponse,
          action: 'speak',
          metadata: {
            nodeType: 'conversation',
            model: node.data?.model || 'default',
            promptUsed: nodePrompt ? 'node-specific' : 'global'
          }
        };

      // ===== END NODE TYPES =====
      case 'endcall':
      case 'end':
      case 'endnode':
        console.log(`[ConversationRelay] 🏁 Executing end node: ${node.id}`);
        const endMessage = node.data?.endMessage || node.data?.farewell || node.data?.message || "Thank you for calling. Have a great day!";

        return {
          response: endMessage,
          action: 'end',
          metadata: {
            nodeType: 'end',
            reason: node.data?.reason || 'completed'
          }
        };

      // ===== TRANSFER NODE TYPES (Not yet functional) =====
      case 'transfercall':
      case 'transfer':
      case 'handoff':
        console.log(`[ConversationRelay] ⚠️  Transfer node not yet functional: ${node.id}`);
        console.log(`[ConversationRelay] 📞 Transfer feature coming soon - continuing conversation`);

        // Inform user that transfer is not available and continue conversation
        const transferMessage = "I'd like to transfer you to a specialist, but that feature is currently unavailable. Let me continue to help you directly. What else can I assist you with?";

        return {
          response: transferMessage,
          action: 'speak',
          metadata: {
            nodeType: 'transfer',
            status: 'not_implemented',
            requestedDestination: node.data?.destination || node.data?.phoneNumber || node.data?.transferTo
          }
        };

      // ===== API REQUEST NODE TYPES (Not yet functional) =====
      case 'apirequest':
      case 'api':
        console.log(`[ConversationRelay] ⚠️  API request node not yet functional: ${node.id}`);
        console.log(`[ConversationRelay] 🔌 API integration feature coming soon - using AI fallback`);

        // Use AI to continue conversation naturally
        const apiMessages = [
          {
            role: 'system',
            content: callData.workflowData?.globalPrompt || 'You are a helpful AI assistant. Provide concise, helpful responses.'
          }
        ];

        if (callData.conversationHistory && callData.conversationHistory.length > 0) {
          apiMessages.push(...callData.conversationHistory.slice(-5));
        }

        apiMessages.push({ role: 'user', content: input });

        const apiResponse = await this.generateAIResponse(apiMessages);

        return {
          response: apiResponse,
          action: 'speak',
          metadata: {
            nodeType: 'api',
            status: 'not_implemented',
            fallbackUsed: true
          }
        };

      // ===== LEGACY NODE TYPES (Keep for backward compatibility) =====
      case 'greeting':
      case 'message':
        return {
          response: node.data?.message || node.data?.text || "Hello! How can I help you?",
          action: 'speak'
        };

      case 'question':
      case 'input':
        return {
          response: node.data?.question || node.data?.prompt || "What would you like to know?",
          action: 'listen',
          expectedInput: node.data?.expectedInput
        };

      case 'menu':
      case 'choice':
        const options = node.data?.options || [];
        const menuText = node.data?.message || "Please choose an option:";
        const optionsText = options.map((opt, idx) => `Press ${idx + 1} for ${opt.label}`).join('. ');
        return {
          response: `${menuText} ${optionsText}`,
          action: 'menu',
          options: options
        };

      // ===== DEFAULT FALLBACK =====
      default:
        console.log(`[ConversationRelay] ⚠️  Unknown node type: ${node.type} - using AI fallback`);

        // Use AI to handle unknown node types gracefully
        const fallbackMessages = [
          {
            role: 'system',
            content: callData.workflowData?.globalPrompt || 'You are a helpful AI assistant. Provide concise, helpful responses.'
          }
        ];

        if (callData.conversationHistory && callData.conversationHistory.length > 0) {
          fallbackMessages.push(...callData.conversationHistory.slice(-5));
        }

        fallbackMessages.push({ role: 'user', content: input });

        const fallbackResponse = await this.generateAIResponse(fallbackMessages);

        return {
          response: fallbackResponse,
          action: 'speak',
          metadata: {
            nodeType: 'unknown',
            originalType: node.type,
            fallbackUsed: true
          }
        };
    }
  }

  determineNextNode(workflowData, currentNode, input, nodeResult) {
    // Find edges from current node
    const edges = workflowData.edges || [];
    const outgoingEdges = edges.filter(edge => edge.source === currentNode.id);

    if (outgoingEdges.length === 0) {
      console.log(`[ConversationRelay] ℹ️  No outgoing edges from node ${currentNode.id}`);
      return null;
    }

    // If only one edge, follow it
    if (outgoingEdges.length === 1) {
      const targetNodeId = outgoingEdges[0].target;
      return this.findNodeById(workflowData.nodes, targetNodeId);
    }

    // Multiple edges - evaluate conditions
    for (const edge of outgoingEdges) {
      if (this.evaluateEdgeCondition(edge, input, nodeResult)) {
        const targetNodeId = edge.target;
        return this.findNodeById(workflowData.nodes, targetNodeId);
      }
    }

    // Default to first edge if no conditions match
    const targetNodeId = outgoingEdges[0].target;
    return this.findNodeById(workflowData.nodes, targetNodeId);
  }

  evaluateEdgeCondition(edge, input, nodeResult) {
    // Evaluate edge condition to determine if this path should be taken
    if (!edge.condition) return true; // No condition = always take this edge

    const condition = edge.condition;
    const inputLower = input.toLowerCase();

    // Check for keyword matches
    if (condition.keywords && Array.isArray(condition.keywords)) {
      return condition.keywords.some(keyword => inputLower.includes(keyword.toLowerCase()));
    }

    // Check for DTMF digit matches
    if (condition.digit && input.startsWith('DTMF:')) {
      const digit = input.substring(5);
      return digit === condition.digit.toString();
    }

    // Check for intent matches
    if (condition.intent) {
      // Simple intent matching - could be enhanced with NLU
      return inputLower.includes(condition.intent.toLowerCase());
    }

    return true;
  }

  async generateAIResponse(messages) {
    // Generate AI response using Azure OpenAI
    try {
      // Check if Azure OpenAI is configured
      if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
        console.error('[ConversationRelay] Missing Azure OpenAI credentials');
        return "I'm here to help. What would you like to know?";
      }

      console.log('[ConversationRelay] 🤖 Calling Azure OpenAI with', messages.length, 'messages');

      const response = await fetch(process.env.AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 100, // Reduced from 150 to 100 for faster responses
          temperature: 0.7,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ConversationRelay] Azure OpenAI API error:', response.status, errorText);
        return "I'm here to help. What would you like to know?";
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('[ConversationRelay] Invalid Azure OpenAI response structure');
        return "I'm here to help. What would you like to know?";
      }

      const aiResponse = data.choices[0].message.content.trim();
      console.log('[ConversationRelay] 🤖 Azure OpenAI response:', aiResponse.substring(0, 100) + '...');

      return aiResponse;

    } catch (error) {
      console.error(`[ConversationRelay] AI response generation error:`, error);
      return "I'm here to help. Could you please tell me more about what you need?";
    }
  }
}

class PerformanceMetrics {
  constructor() {
    this.processingTimes = [];
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  recordProcessingTime(time) {
    this.processingTimes.push(time);

    // Keep only last 100 measurements for memory efficiency
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
  }

  recordError(error) {
    this.errors.push({ timestamp: Date.now(), error });
  }

  recordWarning(warning) {
    this.warnings.push({ timestamp: Date.now(), warning });
  }

  getCurrentMetrics() {
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    const p95ProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.sort((a, b) => a - b)[Math.floor(this.processingTimes.length * 0.95)]
      : 0;

    return {
      averageProcessingTime: avgProcessingTime,
      p95ProcessingTime,
      totalProcessedChunks: this.processingTimes.length,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      uptime: Date.now() - this.startTime
    };
  }

  getFinalMetrics() {
    return {
      ...this.getCurrentMetrics(),
      finalProcessingTimes: [...this.processingTimes],
      allErrors: [...this.errors],
      allWarnings: [...this.warnings]
    };
  }
}

module.exports = ConversationRelay;
