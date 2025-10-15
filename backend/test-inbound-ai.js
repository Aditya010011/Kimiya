/**
 * Test script for Inbound Call Azure OpenAI Integration
 * 
 * This script tests the Azure OpenAI integration for inbound calls
 * without requiring an actual phone call.
 */

require('dotenv').config({ path: '.env.development' });

const inboundCallService = require('./services/InboundCallService');
const inboundWorkflowProcessor = require('./services/InboundWorkflowProcessor');

async function testInboundAIIntegration() {
  console.log('🧪 Testing Inbound Call Azure OpenAI Integration...\n');

  try {
    // Initialize services
    console.log('1️⃣ Initializing services...');
    await inboundCallService.initialize();
    console.log('✅ Services initialized\n');

    // Test Azure OpenAI connection
    console.log('2️⃣ Testing Azure OpenAI connection...');
    const testMessages = [
      {
        role: 'system',
        content: 'You are Kimiya, a helpful AI voice assistant. Respond briefly and conversationally.'
      },
      {
        role: 'user',
        content: 'Hello, can you help me?'
      }
    ];

    const aiResponse = await inboundWorkflowProcessor.callAzureOpenAI(testMessages);
    console.log('✅ Azure OpenAI Response:', aiResponse);
    console.log('');

    // Test workflow processing with AI
    console.log('3️⃣ Testing workflow processing with AI...');

    // First, check if we have any workflows available
    console.log('📋 Checking for available workflows...');
    const databaseService = require('./services/database');
    const pool = await databaseService.getPool();
    const workflowResult = await pool.request().query(`
      SELECT TOP 1 id, name FROM tblWorkflows WHERE is_active = 1
    `);

    if (workflowResult.recordset.length === 0) {
      console.log('⚠️ No workflows found in database. Creating a test workflow...');

      // Create a simple test workflow
      const createResult = await pool.request()
        .input('name', 'test-workflow')
        .input('description', 'Test workflow for AI integration testing')
        .input('is_active', true)
        .input('created_by', 1)
        .query(`
          INSERT INTO tblWorkflows (name, description, is_active, created_by, created_at, updated_at)
          OUTPUT INSERTED.id, INSERTED.name
          VALUES (@name, @description, @is_active, @created_by, GETDATE(), GETDATE())
        `);

      const testWorkflow = createResult.recordset[0];
      console.log('✅ Created test workflow:', testWorkflow);
    }

    // Get the first available workflow
    const availableWorkflow = workflowResult.recordset.length > 0
      ? workflowResult.recordset[0]
      : (await pool.request().query(`SELECT TOP 1 id, name FROM tblWorkflows WHERE is_active = 1`)).recordset[0];

    // Simulate a call
    const mockCallData = {
      CallSid: 'test-call-' + Date.now(),
      From: '+1234567890',
      To: '+17077433838',
      workflowId: availableWorkflow.name,
      workflowName: availableWorkflow.name
    };

    console.log('📞 Using workflow:', availableWorkflow.name);

    // Start call tracking
    await inboundCallService.startInboundCall(mockCallData);
    console.log('✅ Call tracking started for:', mockCallData.CallSid);

    // Add initial system message
    inboundCallService.addConversationMessage(mockCallData.CallSid, 'system', 
      'Call initiated. You are Kimiya, a helpful AI voice assistant.');

    // Test user input processing
    const userInputs = [
      'Hello, I need help with my account',
      'Can you tell me about your services?',
      'Thank you, goodbye'
    ];

    for (let i = 0; i < userInputs.length; i++) {
      const userInput = userInputs[i];
      console.log(`\n📞 User says: "${userInput}"`);

      // Add user message to conversation
      inboundCallService.addConversationMessage(mockCallData.CallSid, 'user', userInput);

      // Get conversation history
      const conversationHistory = inboundCallService.getConversationHistory(mockCallData.CallSid);

      // Process through workflow
      const workflowResult = await inboundWorkflowProcessor.processWorkflowStep(
        mockCallData.workflowId,
        'ai-response',
        {
          userInput,
          callSid: mockCallData.CallSid,
          conversationHistory
        }
      );

      console.log(`🤖 AI responds: "${workflowResult.text}"`);

      // Add AI response to conversation
      if (workflowResult.text) {
        inboundCallService.addConversationMessage(mockCallData.CallSid, 'assistant', workflowResult.text);
      }
    }

    // Test conversation history
    console.log('\n4️⃣ Testing conversation history...');
    const finalHistory = inboundCallService.getConversationHistory(mockCallData.CallSid);
    console.log('📝 Conversation History:');
    finalHistory.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.role}]: ${msg.content}`);
    });

    // End call
    await inboundCallService.endCall(mockCallData.CallSid);
    console.log('\n✅ Call ended successfully');

    console.log('\n🎉 All tests passed! Azure OpenAI integration is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testInboundAIIntegration()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testInboundAIIntegration };
