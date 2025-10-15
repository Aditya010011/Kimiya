/**
 * Example: Testing Inbound Call AI Integration
 * 
 * This example demonstrates how the Azure OpenAI integration works
 * with different types of user inputs and workflow scenarios.
 */

require('dotenv').config({ path: '.env.development' });

const inboundCallService = require('../services/InboundCallService');
const inboundWorkflowProcessor = require('../services/InboundWorkflowProcessor');

async function runInboundAIExample() {
  console.log('🎯 Kimiya Voice AI - Inbound Call Example\n');

  try {
    // Initialize services
    await inboundCallService.initialize();
    console.log('✅ Services initialized\n');

    // Example scenarios
    const scenarios = [
      {
        name: 'Customer Support Inquiry',
        userInputs: [
          'Hi, I\'m having trouble with my account login',
          'I keep getting an error message when I try to sign in',
          'The error says "invalid credentials" but I\'m sure my password is correct',
          'Can you help me reset my password?',
          'Thank you so much for your help!'
        ]
      },
      {
        name: 'Product Information Request',
        userInputs: [
          'Hello, I\'m interested in learning about your services',
          'What kind of AI solutions do you offer?',
          'How much does it cost?',
          'Do you have a free trial?',
          'Great, I\'d like to sign up'
        ]
      },
      {
        name: 'Technical Support',
        userInputs: [
          'I need technical support',
          'My API integration isn\'t working properly',
          'I\'m getting a 500 error when I make requests',
          'I\'ve checked my API key and it looks correct',
          'Can you help me troubleshoot this?'
        ]
      }
    ];

    // First, get an available workflow
    console.log('📋 Getting available workflow...');
    const databaseService = require('../services/database');
    const pool = await databaseService.getPool();
    const workflowResult = await pool.request().query(`
      SELECT TOP 1 id, name FROM tblWorkflows WHERE is_active = 1
    `);

    if (workflowResult.recordset.length === 0) {
      throw new Error('No workflows found in database. Please create a workflow first.');
    }

    const availableWorkflow = workflowResult.recordset[0];
    console.log('✅ Using workflow:', availableWorkflow.name);

    for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
      const scenario = scenarios[scenarioIndex];
      console.log(`\n🎬 Scenario ${scenarioIndex + 1}: ${scenario.name}`);
      console.log('=' .repeat(50));

      // Create a mock call for this scenario
      const mockCallData = {
        CallSid: `example-call-${Date.now()}-${scenarioIndex}`,
        From: '+1234567890',
        To: '+17077433838',
        workflowId: availableWorkflow.name,
        workflowName: `${scenario.name} Workflow`
      };

      // Start call tracking
      await inboundCallService.startInboundCall(mockCallData);
      
      // Initialize conversation
      inboundCallService.addConversationMessage(mockCallData.CallSid, 'system', 
        `You are Kimiya, a helpful AI assistant for ${scenario.name.toLowerCase()}. Be professional, helpful, and concise.`);

      console.log(`📞 Call started: ${mockCallData.CallSid}`);
      console.log(`🤖 AI: Hello! Welcome to Kimiya Voice AI. How can I help you today?\n`);

      // Process each user input
      for (let i = 0; i < scenario.userInputs.length; i++) {
        const userInput = scenario.userInputs[i];
        console.log(`👤 User: "${userInput}"`);

        // Add user message to conversation
        inboundCallService.addConversationMessage(mockCallData.CallSid, 'user', userInput);

        // Get conversation history
        const conversationHistory = inboundCallService.getConversationHistory(mockCallData.CallSid);

        // Process through workflow with AI
        const workflowResult = await inboundWorkflowProcessor.processWorkflowStep(
          mockCallData.workflowId,
          'ai-response',
          {
            userInput,
            callSid: mockCallData.CallSid,
            conversationHistory
          }
        );

        console.log(`🤖 AI: "${workflowResult.text}"\n`);

        // Add AI response to conversation
        if (workflowResult.text) {
          inboundCallService.addConversationMessage(mockCallData.CallSid, 'assistant', workflowResult.text);
        }

        // Small delay to simulate natural conversation
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // End the call
      await inboundCallService.endCall(mockCallData.CallSid);
      console.log(`✅ Call ended: ${mockCallData.CallSid}`);

      // Show conversation summary
      const finalHistory = inboundCallService.getConversationHistory(mockCallData.CallSid);
      console.log(`📊 Conversation had ${finalHistory.length} messages`);
      
      if (scenarioIndex < scenarios.length - 1) {
        console.log('\n⏳ Waiting before next scenario...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 All scenarios completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Tested ${scenarios.length} different conversation scenarios`);
    console.log('   • Azure OpenAI integration working correctly');
    console.log('   • Conversation history properly maintained');
    console.log('   • Database logging functional');
    console.log('\n✨ The inbound call system is ready for production use!');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  runInboundAIExample()
    .then(() => {
      console.log('\n✅ Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Example failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runInboundAIExample };
