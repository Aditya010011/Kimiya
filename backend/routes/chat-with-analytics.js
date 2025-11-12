const fetch = require('node-fetch');
const ChatAnalyticsService = require('../services/ChatAnalyticsService');
const databaseService = require('../services/database');
const { deductCreditsAfterSuccess } = require('../middleware/creditMiddleware');
const conversationKBService = require('../services/ConversationKBService');

// Initialize services
const chatAnalyticsService = new ChatAnalyticsService(databaseService);

// Backend chat endpoint with analytics integration
module.exports = async function chatWithAnalyticsHandler(req, res) {
  console.log('=== CHAT WITH ANALYTICS API ENDPOINT CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Authenticated user:', req.user ? `${req.user.email} (ID: ${req.user.id})` : 'No authentication');
  console.log('Request body:', req.body);

  try {
    const {
      messages,
      workflowId,
      globalPrompt,
      currentNodeId,
      sessionId,
      userId: requestUserId,
      workflowName,
      isNewSession,
      isEndSession,
      knowledgeBases,
      kbRetrievalConfig
    } = req.body;

    // Use authenticated user ID if available, otherwise fall back to request body
    const userId = req.user?.id || requestUserId || 1;
    console.log('👤 USER CONTEXT: Using user ID:', userId, req.user ? `(authenticated: ${req.user.email})` : '(fallback)');

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    console.log('Processing chat request:', {
      workflowId,
      sessionId,
      userId,
      messageCount: messages.length,
      hasGlobalPrompt: !!globalPrompt,
      currentNodeId,
      isNewSession,
      isEndSession
    });

    // Handle new session creation
    if (isNewSession && sessionId && userId && workflowName) {
      try {
        console.log('🚀 ANALYTICS: Starting new chat session:', {
          sessionId,
          workflowId,
          workflowName,
          userId
        });

        await chatAnalyticsService.startChatSession({
          session_id: sessionId,
          workflow_id: workflowId,
          workflow_name: workflowName,
          user_id: parseInt(userId),
          start_time: new Date()
        });

        console.log('✅ ANALYTICS: New chat session created successfully in database');
      } catch (analyticsError) {
        console.error('❌ ANALYTICS: Failed to create analytics session:', analyticsError.message);
        // Continue with chat processing even if analytics fails
      }
    }

    // Get workflow data for context if available
    const workflowData = global.workflowData && global.workflowData[workflowId];
    let systemPrompt = globalPrompt || 'You are a helpful AI assistant in a chat conversation.';
    let currentNode = null;

    if (workflowData) {
      console.log('Found workflow data for chat context');

      if (workflowData.globalPrompt) {
        systemPrompt = workflowData.globalPrompt;
      }

      // Add current node context if available
      if (currentNodeId) {
        currentNode = workflowData.nodes.find(node => node.id === currentNodeId);
        if (currentNode && currentNode.data) {
          if (currentNode.data.prompt) {
            systemPrompt += `\n\nCurrent node context: ${currentNode.data.prompt}`;
          }
          if (currentNode.data.instructions) {
            systemPrompt += `\nInstructions: ${currentNode.data.instructions}`;
          }
        }
      }
    }

    // === KNOWLEDGE BASE INTEGRATION ===
    // Check if node has knowledge bases configured
    let kbContext = '';
    let kbResults = [];
    const nodeKBs = currentNode?.data?.knowledgeBases || knowledgeBases;
    const nodeKBConfig = currentNode?.data?.kbRetrievalConfig || kbRetrievalConfig;

    if (nodeKBs && nodeKBs.length > 0 && req.user) {
      console.log(`[Chat] Querying ${nodeKBs.length} knowledge bases for user ${req.user.id}`);

      try {
        const kbResponse = await conversationKBService.getConversationContext(
          messages,
          nodeKBs,
          req.user.id,
          {
            topK: nodeKBConfig?.topK || 3,
            similarityThreshold: nodeKBConfig?.similarityThreshold || 0.6,
            enableQueryRewriting: nodeKBConfig?.enableQueryRewriting !== false,
            includeScores: true,
            includeKBNames: true
          }
        );

        kbContext = kbResponse.context;
        kbResults = kbResponse.results;

        if (kbContext) {
          console.log(`[Chat] Retrieved ${kbResults.length} KB chunks, adding to system prompt`);
        } else {
          console.log('[Chat] No relevant KB context found');
        }
      } catch (kbError) {
        console.error('[Chat] Error querying knowledge bases:', kbError);
        // Continue without KB context - don't fail the entire request
      }
    } else if (nodeKBs && nodeKBs.length > 0 && !req.user) {
      console.warn('[Chat] Knowledge bases configured but user not authenticated - skipping KB query');
    }

    // Add KB context to system prompt
    if (kbContext) {
      systemPrompt += kbContext;
    }

    // Prepare messages for Azure OpenAI
    const apiMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    console.log('Calling Azure OpenAI for chat...');
    const startTime = Date.now();
    const aiResponse = await callAzureOpenAI(apiMessages);
    const processingTime = Date.now() - startTime;

    // Store messages in analytics if session is tracked
    if (sessionId) {
      try {
        console.log('💬 ANALYTICS: Storing messages for session:', sessionId);

        // Store the user message (last message in the array)
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
          console.log('📝 ANALYTICS: Storing user message:', lastUserMessage.content.substring(0, 50) + '...');

          await chatAnalyticsService.addMessage(sessionId, {
            id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'user',
            content: lastUserMessage.content,
            timestamp: new Date(),
            nodeId: currentNodeId,
            nodeName: workflowData?.nodes?.find(n => n.id === currentNodeId)?.data?.label
          });
        }

        // Store the AI response
        console.log('🤖 ANALYTICS: Storing AI response:', aiResponse.substring(0, 50) + '...');

        await chatAnalyticsService.addMessage(sessionId, {
          id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
          nodeId: currentNodeId,
          nodeName: workflowData?.nodes?.find(n => n.id === currentNodeId)?.data?.label,
          metadata: {
            processing_time: processingTime,
            tokens_used: estimateTokens(aiResponse)
          }
        });

        console.log('✅ ANALYTICS: Messages stored successfully in database');
      } catch (analyticsError) {
        console.error('❌ ANALYTICS: Failed to store messages:', analyticsError.message);
        // Continue with response even if analytics fails
      }
    }

    // Handle session end
    if (isEndSession && sessionId) {
      try {
        console.log('🏁 ANALYTICS: Ending chat session:', sessionId);

        // Determine outcome based on conversation context
        const outcome = determineConversationOutcome(messages, aiResponse);
        console.log('📊 ANALYTICS: Determined session outcome:', outcome);

        await chatAnalyticsService.endChatSession(sessionId, outcome);
        console.log('✅ ANALYTICS: Chat session ended and analyzed successfully');
      } catch (analyticsError) {
        console.error('❌ ANALYTICS: Failed to end analytics session:', analyticsError.message);
      }
    }

    console.log('Chat AI response generated successfully');

    // Deduct credits after successful response (if user is authenticated)
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const creditDeductResult = await deductCreditsAfterSuccess(
      req,
      'chat',
      {
        messageId,
        responseLength: aiResponse.length,
        messageCount: messages.length,
        workflowId,
        workflowName,
        sessionId,
        processingTime,
        tokensUsed: estimateTokens(aiResponse),
        timestamp: new Date().toISOString()
      },
      messageId,
      'chat_message'
    );

    const response = {
      success: true,
      response: aiResponse,
      metadata: {
        processing_time: processingTime,
        session_id: sessionId,
        workflow_id: workflowId,
        node_id: currentNodeId
      },
      timestamp: new Date().toISOString()
    };

    // Add credit information to response if credits were processed
    if (req.creditInfo && creditDeductResult.success && !creditDeductResult.skipped) {
      response.creditInfo = {
        creditsDeducted: req.creditInfo.requiredCredits,
        remainingBalance: creditDeductResult.data.balanceAfter,
        transactionId: creditDeductResult.data.transactionId
      };
    }

    // Add knowledge base information to response if KB was used
    if (kbResults.length > 0) {
      response.knowledgeBaseInfo = {
        chunksUsed: kbResults.length,
        knowledgeBases: [...new Set(kbResults.map(r => r.knowledgeBaseName))],
        averageRelevance: (kbResults.reduce((sum, r) => sum + r.score, 0) / kbResults.length * 100).toFixed(0) + '%'
      };
    }

    res.json(response);

  } catch (error) {
    console.error('=== ERROR IN CHAT WITH ANALYTICS API ===');
    console.error('Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response',
      details: error.message
    });
  }
};

// Call Azure OpenAI API
async function callAzureOpenAI(messages) {
  try {
    console.log('Calling Azure OpenAI for chat...');
    
    const response = await fetch(process.env.AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure OpenAI API error:', response.status, errorText);
      throw new Error(`Azure OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Azure OpenAI chat response received');
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      console.error('Unexpected Azure OpenAI response format:', data);
      throw new Error('Invalid response format from Azure OpenAI');
    }

  } catch (error) {
    console.error('Error calling Azure OpenAI for chat:', error.message);
    throw error;
  }
}

// Determine conversation outcome based on context
function determineConversationOutcome(messages, aiResponse) {
  const lastUserMessage = messages[messages.length - 1];
  const conversationText = messages.map(m => m.content).join(' ').toLowerCase();
  
  // Check for explicit completion indicators
  if (conversationText.includes('thank') || conversationText.includes('bye') || 
      conversationText.includes('goodbye') || conversationText.includes('done')) {
    return 'success';
  }
  
  // Check for problem indicators
  if (conversationText.includes('problem') || conversationText.includes('error') || 
      conversationText.includes('not working') || conversationText.includes('confused')) {
    return 'failure';
  }
  
  // Check for partial completion
  if (conversationText.includes('help') || conversationText.includes('question')) {
    return 'partial_success';
  }
  
  // Default to success if conversation seems complete
  if (messages.length >= 4) {
    return 'success';
  }
  
  return 'partial_success';
}

// Estimate token count (rough approximation)
function estimateTokens(text) {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}
