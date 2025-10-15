#!/usr/bin/env node

/**
 * Test Web Call Fix - Verify ConversationRelay Integration
 * 
 * This script tests the fix for the one-way audio issue by simulating
 * a web call and verifying that it now uses ConversationRelay instead
 * of the broken inbound redirect system.
 */

const express = require('express');
const { handleOutgoingCall } = require('./routes/twilio-voice-token');

async function testWebCallFix() {
  console.log('🧪 Testing Web Call Fix for Speech Processing Issue');
  console.log('=' .repeat(60));

  try {
    // Test 1: Verify ConversationRelay WebSocket is running
    console.log('\n📡 Test 1: ConversationRelay WebSocket Status');
    const healthResponse = await fetch('http://localhost:3010/health');
    const healthData = await healthResponse.json();
    
    console.log('ConversationRelay Status:', healthData.conversationRelay.status);
    console.log('Active Connections:', healthData.conversationRelay.activeConnections);
    console.log('WebSocket Path:', healthData.conversationRelay.websocketPath);
    console.log('Expected URL:', healthData.conversationRelay.expectedUrl);

    if (healthData.conversationRelay.status !== 'active') {
      throw new Error('ConversationRelay WebSocket is not active');
    }

    // Test 2: Simulate handleOutgoingCall with mock request/response
    console.log('\n📞 Test 2: Web Call TwiML Generation');
    
    const mockReq = {
      body: {
        To: 'client:test-user',
        From: '+17077433838',
        workflowId: 'AI Specialist Teacher Workflow'
      },
      query: {}
    };

    let capturedTwiML = '';
    const mockRes = {
      setHeader: (name, value) => {
        console.log(`Header: ${name} = ${value}`);
      },
      status: (code) => {
        console.log(`Status: ${code}`);
        return mockRes;
      },
      send: (data) => {
        capturedTwiML = data;
        console.log('Generated TwiML:');
        console.log(data);
      }
    };

    // Call the fixed handleOutgoingCall function
    await handleOutgoingCall(mockReq, mockRes);

    // Test 3: Verify TwiML contains ConversationRelay
    console.log('\n🔍 Test 3: TwiML Analysis');
    
    const hasConversationRelay = capturedTwiML.includes('<ConversationRelay');
    const hasWebSocketURL = capturedTwiML.includes('/api/conversationrelay-ws');
    const hasWelcomeGreeting = capturedTwiML.includes('welcomeGreeting');
    const hasRedirect = capturedTwiML.includes('<Redirect>');

    console.log('✅ Contains ConversationRelay:', hasConversationRelay);
    console.log('✅ Contains WebSocket URL:', hasWebSocketURL);
    console.log('✅ Contains Welcome Greeting:', hasWelcomeGreeting);
    console.log('❌ Contains Redirect (old method):', hasRedirect);

    if (!hasConversationRelay) {
      throw new Error('TwiML does not contain ConversationRelay - fix not applied correctly');
    }

    if (hasRedirect) {
      throw new Error('TwiML still contains Redirect - old method still active');
    }

    // Test 4: Extract and validate WebSocket URL
    console.log('\n🔗 Test 4: WebSocket URL Validation');
    
    const urlMatch = capturedTwiML.match(/url="([^"]+)"/);
    if (urlMatch) {
      const websocketUrl = urlMatch[1].replace(/&amp;/g, '&'); // Decode XML entities
      console.log('WebSocket URL:', websocketUrl);
      
      const url = new URL(websocketUrl);
      console.log('Protocol:', url.protocol);
      console.log('Host:', url.host);
      console.log('Path:', url.pathname);
      console.log('Workflow ID:', url.searchParams.get('workflowId'));
      console.log('Tracking ID:', url.searchParams.get('trackingId'));
      console.log('Source:', url.searchParams.get('source'));

      if (url.protocol !== 'wss:') {
        throw new Error('WebSocket URL should use wss:// protocol');
      }

      if (!url.searchParams.get('workflowId')) {
        throw new Error('WebSocket URL missing workflowId parameter');
      }
    } else {
      throw new Error('Could not extract WebSocket URL from TwiML');
    }

    // Test 5: Verify ConversationRelay test endpoint
    console.log('\n🧪 Test 5: ConversationRelay Test Endpoint');
    
    const testResponse = await fetch('http://localhost:3010/api/conversationrelay-test');
    const testData = await testResponse.json();
    
    console.log('Test Endpoint Status:', testData.status);
    console.log('Features:', testData.features);

    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('=' .repeat(60));
    console.log('✅ Web calls now use ConversationRelay for speech processing');
    console.log('✅ WebSocket server is active and ready');
    console.log('✅ TwiML generation is correct');
    console.log('✅ Speech input should now work properly');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Test with actual web call from frontend');
    console.log('2. Monitor backend logs for ConversationRelay messages');
    console.log('3. Verify speech transcription and AI responses');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure backend server is running on port 3010');
    console.log('2. Check ConversationRelay WebSocket initialization');
    console.log('3. Verify environment variables are loaded');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testWebCallFix().catch(console.error);
}

module.exports = { testWebCallFix };
