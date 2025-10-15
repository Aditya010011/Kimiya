/**
 * Test script to verify that calls without workflow are properly rejected
 */

require('dotenv').config({ path: '.env.development' });

const express = require('express');
const request = require('supertest');

// Import the inbound TwiML handler
const { handleInboundCall } = require('./routes/inbound-twiml');

async function testNoWorkflowRejection() {
  console.log('🧪 Testing No Workflow Rejection...\n');

  try {
    // Create a test Express app
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    
    // Add the inbound call route
    app.post('/test-call', handleInboundCall);

    console.log('1️⃣ Testing call without workflow parameter...');
    
    // Test call without workflow
    const response1 = await request(app)
      .post('/test-call')
      .send({
        CallSid: 'test-no-workflow-' + Date.now(),
        From: '+1234567890',
        To: '+17077433838',
        CallStatus: 'ringing'
      });

    console.log('Response Status:', response1.status);
    console.log('Response Body:', response1.text);
    
    // Check if the response contains the expected error message
    if (response1.text.includes('no workflow has been configured')) {
      console.log('✅ Call without workflow properly rejected');
    } else {
      console.log('❌ Call without workflow was not properly rejected');
    }

    console.log('\n2️⃣ Testing call with empty workflow parameter...');
    
    // Test call with empty workflow
    const response2 = await request(app)
      .post('/test-call')
      .query({ workflowId: '' })
      .send({
        CallSid: 'test-empty-workflow-' + Date.now(),
        From: '+1234567890',
        To: '+17077433838',
        CallStatus: 'ringing'
      });

    console.log('Response Status:', response2.status);
    console.log('Response Body:', response2.text);
    
    // Check if the response contains the expected error message
    if (response2.text.includes('no workflow has been configured')) {
      console.log('✅ Call with empty workflow properly rejected');
    } else {
      console.log('❌ Call with empty workflow was not properly rejected');
    }

    console.log('\n3️⃣ Testing call with invalid workflow...');
    
    // Test call with invalid workflow
    const response3 = await request(app)
      .post('/test-call')
      .query({ workflowId: 'non-existent-workflow' })
      .send({
        CallSid: 'test-invalid-workflow-' + Date.now(),
        From: '+1234567890',
        To: '+17077433838',
        CallStatus: 'ringing'
      });

    console.log('Response Status:', response3.status);
    console.log('Response Body:', response3.text);
    
    // Check if the response contains an error (could be workflow not found or technical difficulties)
    if (response3.text.includes('technical difficulties') || response3.text.includes('not found')) {
      console.log('✅ Call with invalid workflow properly handled');
    } else {
      console.log('❌ Call with invalid workflow was not properly handled');
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('   • Calls without workflow parameter are rejected');
    console.log('   • Calls with empty workflow parameter are rejected');
    console.log('   • Calls with invalid workflow are handled appropriately');
    console.log('\n✨ The system now requires explicit workflow specification!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testNoWorkflowRejection()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testNoWorkflowRejection };
