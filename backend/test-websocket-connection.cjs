#!/usr/bin/env node

const WebSocket = require('ws');

/**
 * Test WebSocket connection to ConversationRelay endpoint
 */
async function testWebSocketConnection() {
  console.log('🔧 Testing WebSocket Connection to ConversationRelay');
  console.log('==================================================');

  // Test parameters (using the same format as the frontend)
  const testCallSid = 'test_call_websocket_test_123';
  const testTrackingId = 'test_track_websocket_test_123';
  const workflowId = '86';
  const inboundConfigId = '6';
  
  const wsUrl = `ws://localhost:3010/api/conversationrelay-ws?callSid=${testCallSid}&trackingId=${testTrackingId}&workflowId=${workflowId}&type=test&inboundConfigId=${inboundConfigId}`;
  
  console.log(`\n🔗 Connecting to: ${wsUrl}`);
  console.log(`📞 Call SID: ${testCallSid}`);
  console.log(`🔍 Tracking ID: ${testTrackingId}`);
  console.log(`⚙️  Workflow ID: ${workflowId}`);
  console.log(`📋 Inbound Config ID: ${inboundConfigId}`);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let connectionEstablished = false;
    
    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    
    // Set connection timeout (same as frontend: 10 seconds)
    const timeout = setTimeout(() => {
      if (!connectionEstablished) {
        console.log('\n❌ WebSocket connection timeout (10 seconds)');
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 10000);

    ws.on('open', () => {
      connectionEstablished = true;
      clearTimeout(timeout);
      const connectionTime = Date.now() - startTime;
      
      console.log(`\n✅ WebSocket connection established in ${connectionTime}ms`);
      console.log('📡 Connection state: OPEN');
      console.log('🎉 Ready to send/receive messages');
      
      // Send a test setup message (similar to what the frontend sends)
      const setupMessage = {
        type: 'setup',
        callSid: testCallSid,
        trackingId: testTrackingId,
        testCall: true,
        inboundConfig: {
          id: inboundConfigId,
          phoneNumber: '+17077433838',
          workflowId: workflowId
        },
        simulatedCaller: {
          number: '+1555WSTEST123',
          name: 'WebSocket Test Caller'
        }
      };
      
      console.log('\n📤 Sending setup message...');
      ws.send(JSON.stringify(setupMessage));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('\n📥 Received message:', {
          type: message.type,
          status: message.status,
          timestamp: new Date().toISOString()
        });
        
        if (message.type === 'setup_complete' || message.type === 'ready') {
          console.log('✅ Setup completed successfully');
          ws.close();
          resolve({
            success: true,
            connectionTime: Date.now() - startTime,
            message: 'WebSocket connection and setup successful'
          });
        }
      } catch (error) {
        console.log('\n📥 Received non-JSON message:', data.toString());
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`\n❌ WebSocket error: ${error.message}`);
      console.log(`🔍 Error details:`, error);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      const connectionTime = Date.now() - startTime;
      
      console.log(`\n🔌 WebSocket connection closed`);
      console.log(`📊 Close code: ${code}`);
      console.log(`📝 Close reason: ${reason || 'No reason provided'}`);
      console.log(`⏱️  Total connection time: ${connectionTime}ms`);
      
      if (connectionEstablished) {
        resolve({
          success: true,
          connectionTime,
          message: 'WebSocket connection successful (closed normally)'
        });
      } else {
        reject(new Error(`WebSocket closed before connection established (code: ${code})`));
      }
    });
  });
}

// Run the test
async function runTest() {
  try {
    console.log('🚀 Starting WebSocket connection test...\n');
    
    const result = await testWebSocketConnection();
    
    console.log('\n🎉 TEST RESULT: SUCCESS');
    console.log('========================');
    console.log(`✅ Connection Time: ${result.connectionTime}ms`);
    console.log(`✅ Status: ${result.message}`);
    console.log('\n🔧 WebSocket connection issue is RESOLVED!');
    console.log('The frontend should now be able to connect successfully.');
    
    process.exit(0);
    
  } catch (error) {
    console.log('\n❌ TEST RESULT: FAILURE');
    console.log('========================');
    console.log(`❌ Error: ${error.message}`);
    console.log('\n🔧 WebSocket connection issue still exists:');
    console.log('1. Check if the backend server is running on port 3010');
    console.log('2. Verify the WebSocket server is properly initialized');
    console.log('3. Check for any firewall or network issues');
    console.log('4. Review the backend logs for WebSocket server errors');
    
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
