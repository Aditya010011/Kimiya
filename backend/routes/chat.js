const fetch = require('node-fetch');
const { deductCreditsAfterSuccess } = require('../middleware/creditMiddleware');
const conversationKBService = require('../services/ConversationKBService');

// Backend chat endpoint for playground conversations
module.exports = async function chatHandler(req, res) {
  console.log('=== CHAT API ENDPOINT CALLED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request body:', req.body);

  try {
    const { messages, workflowId, globalPrompt, currentNodeId, knowledgeBases, kbRetrievalConfig } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    console.log('Processing chat request:', {
      workflowId,
      messageCount: messages.length,
      hasGlobalPrompt: !!globalPrompt,
      currentNodeId,
      hasKnowledgeBases: !!(knowledgeBases && knowledgeBases.length > 0)
    });

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
    const aiResponse = await callAzureOpenAI(apiMessages);

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
        timestamp: new Date().toISOString()
      },
      messageId,
      'chat_message'
    );

    const response = {
      success: true,
      response: aiResponse,
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

    // Add KB information to response if KB was used
    if (kbResults.length > 0) {
      response.knowledgeBaseInfo = {
        chunksUsed: kbResults.length,
        knowledgeBases: [...new Set(kbResults.map(r => r.knowledgeBaseName))],
        averageRelevance: (kbResults.reduce((sum, r) => sum + r.score, 0) / kbResults.length * 100).toFixed(0) + '%'
      };
    }

    res.json(response);

  } catch (error) {
    console.error('=== ERROR IN CHAT API ===');
    console.error('Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response',
      details: error.message
    });
  }
};

// Call Azure OpenAI API (same as twiml-ai.js but for chat)
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
