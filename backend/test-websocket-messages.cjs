#!/usr/bin/env node

const WebSocket = require('ws');

/**
 * Test WebSocket message handling for test calls
 */
async function testWebSocketMessages() {
  console.log('🔧 Testing WebSocket Message Handling');
  console.log('====================================');

  // Test parameters
  const testCallSid = 'test_call_message_test_123';
  const testTrackingId = 'test_track_message_test_123';
  const workflowId = '86';
  const inboundConfigId = '6';
  
  const wsUrl = `ws://localhost:3010/api/conversationrelay-ws?callSid=${testCallSid}&trackingId=${testTrackingId}&workflowId=${workflowId}&type=test&inboundConfigId=${inboundConfigId}`;
  
  console.log(`\n🔗 Connecting to: ${wsUrl}`);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let connectionEstablished = false;
    let setupCompleted = false;
    let receivedMessages = [];
    
    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    
    // Set connection timeout
    const timeout = setTimeout(() => {
      if (!connectionEstablished) {
        console.log('\n❌ WebSocket connection timeout');
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      } else if (!setupCompleted) {
        console.log('\n❌ Setup message timeout');
        ws.close();
        reject(new Error('Setup message timeout'));
      }
    }, 10000);

    ws.on('open', () => {
      connectionEstablished = true;
      const connectionTime = Date.now() - startTime;
      
      console.log(`\n✅ WebSocket connected in ${connectionTime}ms`);
      
      // Send test-setup message (corrected message type)
      const setupMessage = {
        type: 'test-setup',
        callSid: testCallSid,
        trackingId: testTrackingId,
        testCall: true,
        inboundConfig: {
          id: inboundConfigId,
          phoneNumber: '+17077433838',
          workflowId: workflowId
        },
        simulatedCaller: {
          number: '+1555MSGTEST123',
          name: 'Message Test Caller'
        }
      };
      
      console.log('\n📤 Sending test-setup message...');
      console.log('Message type:', setupMessage.type);
      ws.send(JSON.stringify(setupMessage));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        receivedMessages.push(message);
        
        console.log(`\n📥 Received message #${receivedMessages.length}:`);
        console.log('  Type:', message.type);
        console.log('  Status:', message.status);
        console.log('  Message:', message.message);
        
        if (message.type === 'connected' && message.status === 'test-call-ready') {
          setupCompleted = true;
          console.log('\n✅ Test call setup completed successfully!');
          
          // Send a test text input to see if conversation works
          setTimeout(() => {
            const textMessage = {
              type: 'text-input',
              callSid: testCallSid,
              text: 'Hello, this is a test message'
            };
            
            console.log('\n📤 Sending test text input...');
            ws.send(JSON.stringify(textMessage));
          }, 1000);
          
          // Close connection after testing
          setTimeout(() => {
            console.log('\n🔌 Closing connection...');
            ws.close();
          }, 3000);
        }
        
        if (message.type === 'text') {
          console.log('\n💬 AI Response received:', message.text || message.content);
        }
        
      } catch (error) {
        console.log('\n📥 Received non-JSON message:', data.toString());
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`\n❌ WebSocket error: ${error.message}`);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      const connectionTime = Date.now() - startTime;
      
      console.log(`\n🔌 WebSocket connection closed`);
      console.log(`📊 Close code: ${code}`);
      console.log(`📝 Close reason: ${reason || 'No reason provided'}`);
      console.log(`⏱️  Total connection time: ${connectionTime}ms`);
      console.log(`📨 Total messages received: ${receivedMessages.length}`);
      
      if (setupCompleted && receivedMessages.length > 0) {
        resolve({
          success: true,
          connectionTime,
          messagesReceived: receivedMessages.length,
          setupCompleted,
          messages: receivedMessages
        });
      } else if (connectionEstablished) {
        reject(new Error(`Setup not completed. Received ${receivedMessages.length} messages`));
      } else {
        reject(new Error(`Connection closed before establishment (code: ${code})`));
      }
    });
  });
}

// Run the test
async function runTest() {
  try {
    console.log('🚀 Starting WebSocket message handling test...\n');
    
    const result = await testWebSocketMessages();
    
    console.log('\n🎉 TEST RESULT: SUCCESS');
    console.log('========================');
    console.log(`✅ Connection Time: ${result.connectionTime}ms`);
    console.log(`✅ Messages Received: ${result.messagesReceived}`);
    console.log(`✅ Setup Completed: ${result.setupCompleted}`);
    console.log('\n🔧 Message handling is working correctly!');
    console.log('The frontend should now handle test-setup and text messages properly.');
    
    // Show message types received
    if (result.messages.length > 0) {
      console.log('\n📨 Message types received:');
      result.messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.type} - ${msg.status || msg.message || 'No status'}`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.log('\n❌ TEST RESULT: FAILURE');
    console.log('========================');
    console.log(`❌ Error: ${error.message}`);
    console.log('\n🔧 Issues to investigate:');
    console.log('1. Check if backend WebSocket server is handling test-setup messages');
    console.log('2. Verify conversation service initialization');
    console.log('3. Check for any backend errors in PM2 logs');
    console.log('4. Ensure database connection is working');
    
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Test terminated');
  process.exit(1);
});

// Run the test
runTest();
