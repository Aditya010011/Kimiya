/**
 * Inbound Workflow Processor for Kimiya Voice AI
 * 
 * Processes inbound calls through workflow logic using TwiML approach
 * Integrates with existing workflow system but uses traditional TwiML instead of ConversationRelay
 */

const sql = require('mssql');
const databaseService = require('./database');

class InboundWorkflowProcessor {
  constructor() {
    this.workflowCache = new Map(); // Cache loaded workflows
    this.nodeProcessors = new Map(); // Node type processors
    this.setupNodeProcessors();
  }

  /**
   * Setup node processors for different node types
   */
  setupNodeProcessors() {
    // Start node processor
    this.nodeProcessors.set('start', (node, context) => {
      return {
        type: 'say',
        text: node.data?.welcomeMessage || 'Welcome to Kimiya Voice AI. How can I help you today?',
        nextAction: 'gather',
        gatherConfig: {
          input: 'speech dtmf',
          timeout: 10,
          speechTimeout: 3
        }
      };
    });

    // AI Response node processor
    this.nodeProcessors.set('ai-response', (node, context) => {
      const prompt = node.data?.prompt || 'You are a helpful AI assistant.';
      const userInput = context.userInput || '';
      
      return {
        type: 'ai-response',
        prompt: prompt,
        userInput: userInput,
        nextAction: 'gather'
      };
    });

    // Condition node processor
    this.nodeProcessors.set('condition', (node, context) => {
      const conditions = node.data?.conditions || [];
      const userInput = (context.userInput || '').toLowerCase();
      
      // Simple keyword matching
      for (const condition of conditions) {
        const keywords = condition.keywords || [];
        if (keywords.some(keyword => userInput.includes(keyword.toLowerCase()))) {
          return {
            type: 'redirect',
            targetNodeId: condition.targetNodeId,
            matched: true
          };
        }
      }
      
      // Default path
      return {
        type: 'redirect',
        targetNodeId: node.data?.defaultTarget,
        matched: false
      };
    });

    // End node processor
    this.nodeProcessors.set('end', (node, context) => {
      return {
        type: 'hangup',
        text: node.data?.endMessage || 'Thank you for calling. Goodbye!',
        shouldEnd: true
      };
    });

    // Transfer node processor
    this.nodeProcessors.set('transfer', (node, context) => {
      return {
        type: 'dial',
        number: node.data?.transferNumber,
        text: node.data?.transferMessage || 'Please hold while I transfer your call.'
      };
    });

    // Gather node processor
    this.nodeProcessors.set('gather', (node, context) => {
      return {
        type: 'gather',
        text: node.data?.prompt || 'Please provide your input.',
        gatherConfig: {
          input: node.data?.inputType || 'speech dtmf',
          timeout: node.data?.timeout || 10,
          speechTimeout: node.data?.speechTimeout || 3,
          numDigits: node.data?.numDigits,
          finishOnKey: node.data?.finishOnKey
        }
      };
    });
  }

  /**
   * Load workflow from database
   */
  async loadWorkflow(workflowId) {
    try {
      // Check cache first
      if (this.workflowCache.has(workflowId)) {
        return this.workflowCache.get(workflowId);
      }

      console.log('📋 Loading workflow:', workflowId);
      const pool = await databaseService.getPool();

      // Get workflow info - handle both string names and integer IDs
      let workflowResult;
      if (typeof workflowId === 'string' && isNaN(parseInt(workflowId))) {
        // String name lookup
        workflowResult = await pool.request()
          .input('workflowName', sql.NVarChar(255), workflowId)
          .query(`
            SELECT id, name, description, is_active
            FROM tblWorkflows
            WHERE name = @workflowName AND is_active = 1
          `);
      } else {
        // Integer ID lookup
        const numericId = parseInt(workflowId);
        workflowResult = await pool.request()
          .input('workflowId', sql.Int, numericId)
          .query(`
            SELECT id, name, description, is_active
            FROM tblWorkflows
            WHERE id = @workflowId AND is_active = 1
          `);
      }

      if (workflowResult.recordset.length === 0) {
        console.error(`❌ Workflow not found in database: ${workflowId}`);
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      const workflow = workflowResult.recordset[0];
      const dbWorkflowId = workflow.id;

      // For now, create a simple default workflow structure
      // TODO: Implement proper workflow nodes/edges loading when tables are ready
      const workflowData = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.is_active,
        startNodeId: 'start',
        nodes: new Map([
          ['start', {
            id: 'start',
            type: 'start',
            data: {
              message: 'Hello! Welcome to Kimiya Voice AI. I\'m your intelligent assistant. How can I help you today?'
            }
          }],
          ['ai-response', {
            id: 'ai-response',
            type: 'ai-response',
            data: {
              prompt: 'You are a helpful AI assistant. Respond to the user\'s question or request in a friendly and professional manner.',
              maxTokens: 150
            }
          }]
        ]),
        edges: [
          { from: 'start', to: 'ai-response' },
          { from: 'ai-response', to: 'ai-response' } // Loop for conversation
        ],
        config: new Map([
          ['timeout', '10'],
          ['speechTimeout', '3'],
          ['language', 'en-US']
        ])
      };

      // Cache and return the workflow
      this.workflowCache.set(workflowId, workflowData);
      console.log(`✅ Workflow loaded: ${workflowData.name} (${workflowData.nodes.size} nodes, ${workflowData.edges.length} edges)`);

      return workflowData;

    } catch (error) {
      console.error('❌ Failed to load workflow:', error.message);
      throw error;
    }
  }

  /**
   * Process workflow step - simplified version
   */
  async processWorkflowStep(workflowId, nodeId, context = {}) {
    try {
      console.log('🔄 Processing workflow step:', { workflowId, nodeId, context });

      // Load workflow
      const workflow = await this.loadWorkflow(workflowId);

      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Get the current node or default to start
      const currentNodeId = nodeId || workflow.startNodeId;
      const currentNode = workflow.nodes.get(currentNodeId);

      if (!currentNode) {
        console.error(`❌ Node not found in workflow: ${currentNodeId}`);
        throw new Error(`Node not found in workflow: ${currentNodeId}`);
      }

      // Process based on node type
      if (currentNode.type === 'start') {
        return {
          type: 'say',
          text: currentNode.data.message,
          nextAction: 'gather',
          gatherConfig: {
            input: 'speech dtmf',
            speechTimeout: 3,
            timeout: 10
          },
          nodeId: currentNodeId,
          nextNode: 'ai-response'
        };
      } else if (currentNode.type === 'ai-response') {
        // Handle AI response with user input
        const userInput = context.userInput || '';

        if (userInput.trim()) {
          // Prepare context for AI response generation
          const aiContext = {
            callSid: context.callSid,
            workflowId: workflowId,
            conversationHistory: context.conversationHistory || [],
            activeCall: context.activeCall
          };

          // Generate AI response using Azure OpenAI
          const aiResponse = await this.generateAIResponse(userInput, currentNode.data, aiContext);

          return {
            type: 'say',
            text: aiResponse,
            nextAction: 'gather',
            gatherConfig: {
              input: 'speech dtmf',
              speechTimeout: 3,
              timeout: 10
            },
            nodeId: currentNodeId,
            nextNode: 'ai-response'
          };
        } else {
          // No input, prompt for input
          return {
            type: 'gather',
            text: 'I\'m listening. Please tell me how I can help you.',
            gatherConfig: {
              input: 'speech dtmf',
              speechTimeout: 3,
              timeout: 10
            },
            nodeId: currentNodeId,
            nextNode: 'ai-response'
          };
        }
      }

      // If we reach here, the node type is not supported
      throw new Error(`Unsupported node type: ${currentNode.type}`);

    } catch (error) {
      console.error('❌ Failed to process workflow step:', error.message);
      throw error; // Re-throw the error instead of providing fallback
    }
  }

  /**
   * Generate AI response using Azure OpenAI
   */
  async generateAIResponse(userInput, nodeData, context = {}) {
    try {
      console.log('🤖 Generating AI response with Azure OpenAI...');

      // Get workflow and conversation context
      const { callSid, workflowId, conversationHistory = [] } = context;

      // Load workflow data for context
      let workflowData = null;
      try {
        workflowData = await this.loadWorkflow(workflowId);
      } catch (error) {
        console.warn('⚠️ Could not load workflow data, using default context');
      }

      // Build system prompt
      let systemPrompt = 'You are Kimiya, a helpful AI voice assistant. You are having a phone conversation with a caller. Provide clear, concise, and helpful responses. Keep responses conversational and under 100 words since this is a voice call.';

      // Add workflow global prompt if available
      if (workflowData && workflowData.globalPrompt) {
        systemPrompt = workflowData.globalPrompt;
      }

      // Add node-specific context if available
      if (nodeData && nodeData.prompt) {
        systemPrompt += `\n\nCurrent context: ${nodeData.prompt}`;
      }

      if (nodeData && nodeData.instructions) {
        systemPrompt += `\nInstructions: ${nodeData.instructions}`;
      }

      // Prepare messages for Azure OpenAI
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Add conversation history (last 10 messages to keep context manageable)
      const recentHistory = conversationHistory.slice(-10);
      messages.push(...recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })));

      // Add current user input
      messages.push({
        role: 'user',
        content: userInput
      });

      console.log(`🔄 Calling Azure OpenAI with ${messages.length} messages for call ${callSid}`);

      // Call Azure OpenAI
      const aiResponse = await this.callAzureOpenAI(messages);

      console.log(`✅ Azure OpenAI response generated for call ${callSid}`);
      return aiResponse;

    } catch (error) {
      console.error('❌ Failed to generate AI response:', error.message);

      // Fallback response
      const fallbackResponses = [
        'I apologize, but I\'m having trouble processing your request right now. Could you please try again?',
        'I\'m experiencing some technical difficulties. How else can I help you?',
        'Let me try to help you with that. Could you please rephrase your question?'
      ];

      return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
  }

  /**
   * Call Azure OpenAI API
   */
  async callAzureOpenAI(messages) {
    try {
      // Validate environment variables
      if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
        console.error('❌ Missing Azure OpenAI credentials');
        throw new Error('Azure OpenAI credentials not configured');
      }

      console.log('🔗 Calling Azure OpenAI API...');

      const response = await fetch(process.env.AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 200, // Shorter responses for voice calls
          temperature: 0.7,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Azure OpenAI API error:', response.status, errorText);
        throw new Error(`Azure OpenAI API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ Invalid Azure OpenAI response structure:', data);
        throw new Error('Invalid response format from Azure OpenAI');
      }

      const aiResponse = data.choices[0].message.content.trim();
      console.log('✅ Azure OpenAI response received:', aiResponse.substring(0, 100) + '...');

      return aiResponse;

    } catch (error) {
      console.error('❌ Azure OpenAI call failed:', error.message);
      throw error;
    }
  }

  /**
   * Get workflow start node
   */
  async getWorkflowStartNode(workflowId) {
    try {
      const workflow = await this.loadWorkflow(workflowId);
      return workflow.startNodeId;
    } catch (error) {
      console.error('❌ Failed to get workflow start node:', error.message);
      throw error; // Re-throw error instead of providing fallback
    }
  }
}

// Create and export singleton instance
const inboundWorkflowProcessor = new InboundWorkflowProcessor();
module.exports = inboundWorkflowProcessor;
