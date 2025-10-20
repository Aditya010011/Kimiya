const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3010/api';
const TEST_USER = {
  email: 'test@kimiya.ai',
  password: 'test123'
};

let authToken = null;
let userId = null;

/**
 * Test the chat endpoints with credit integration
 */
async function testChatCredits() {
  console.log('🧪 Testing Chat Endpoints with Credit Integration...\n');
  
  try {
    // Step 1: Login to get auth token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    
    if (loginResponse.data.success) {
      authToken = loginResponse.data.data.tokens.access_token;
      userId = loginResponse.data.data.user.id;
      console.log(`✅ Login successful! User ID: ${userId}`);
    } else {
      throw new Error('Login failed');
    }
    
    // Step 2: Check initial credit balance
    console.log('\n2️⃣ Checking initial credit balance...');
    const initialBalanceResponse = await axios.get(`${BASE_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (initialBalanceResponse.data.success) {
      console.log(`✅ Initial balance: ${initialBalanceResponse.data.data.currentBalance} credits`);
    } else {
      console.log('❌ Failed to get initial balance:', initialBalanceResponse.data.error);
    }
    
    // Step 3: Allocate some credits for testing
    console.log('\n3️⃣ Allocating credits for testing...');
    const allocateResponse = await axios.post(`${BASE_URL}/credits/admin/allocate`, {
      userId: userId,
      amount: 100,
      notes: 'Credits for chat testing'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (allocateResponse.data.success) {
      console.log(`✅ Allocated 100 credits. New balance: ${allocateResponse.data.data.balanceAfter}`);
    } else {
      console.log('❌ Failed to allocate credits:', allocateResponse.data.error);
    }
    
    // Step 4: Test basic chat endpoint with credits
    console.log('\n4️⃣ Testing basic chat endpoint with credits...');
    const chatResponse = await axios.post(`${BASE_URL}/chat`, {
      messages: [
        { role: 'user', content: 'Hello, can you help me with a simple question?' }
      ],
      workflowId: 'test-workflow',
      globalPrompt: 'You are a helpful assistant. Keep responses brief.'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (chatResponse.data.success) {
      console.log('✅ Basic chat successful!');
      console.log(`   Response: ${chatResponse.data.response.substring(0, 100)}...`);
      if (chatResponse.data.creditInfo) {
        console.log(`   Credits deducted: ${chatResponse.data.creditInfo.creditsDeducted}`);
        console.log(`   Remaining balance: ${chatResponse.data.creditInfo.remainingBalance}`);
      } else {
        console.log('   No credit info in response (might be expected for backward compatibility)');
      }
    } else {
      console.log('❌ Basic chat failed:', chatResponse.data.error);
    }
    
    // Step 5: Test chat-with-analytics endpoint with credits
    console.log('\n5️⃣ Testing chat-with-analytics endpoint with credits...');
    const sessionId = `session_${Date.now()}`;
    const analyticsResponse = await axios.post(`${BASE_URL}/chat-with-analytics`, {
      messages: [
        { role: 'user', content: 'What is the weather like today?' }
      ],
      workflowId: 'test-workflow-analytics',
      workflowName: 'Test Workflow',
      sessionId: sessionId,
      userId: userId,
      isNewSession: true,
      globalPrompt: 'You are a helpful weather assistant.'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (analyticsResponse.data.success) {
      console.log('✅ Analytics chat successful!');
      console.log(`   Response: ${analyticsResponse.data.response.substring(0, 100)}...`);
      console.log(`   Session ID: ${analyticsResponse.data.metadata.session_id}`);
      if (analyticsResponse.data.creditInfo) {
        console.log(`   Credits deducted: ${analyticsResponse.data.creditInfo.creditsDeducted}`);
        console.log(`   Remaining balance: ${analyticsResponse.data.creditInfo.remainingBalance}`);
      }
    } else {
      console.log('❌ Analytics chat failed:', analyticsResponse.data.error);
    }
    
    // Step 6: Check updated credit balance
    console.log('\n6️⃣ Checking updated credit balance...');
    const updatedBalanceResponse = await axios.get(`${BASE_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (updatedBalanceResponse.data.success) {
      console.log(`✅ Updated balance: ${updatedBalanceResponse.data.data.currentBalance} credits`);
      console.log(`   Total used: ${updatedBalanceResponse.data.data.usedCredits} credits`);
    } else {
      console.log('❌ Failed to get updated balance:', updatedBalanceResponse.data.error);
    }
    
    // Step 7: Test insufficient credits scenario
    console.log('\n7️⃣ Testing insufficient credits scenario...');
    
    // First, let's reduce the user's balance to 0
    const currentBalance = updatedBalanceResponse.data.data.currentBalance;
    if (currentBalance > 0) {
      console.log(`   Deducting ${currentBalance} credits to test insufficient credits...`);
      await axios.post(`${BASE_URL}/credits/deduct`, {
        amount: currentBalance,
        serviceType: 'chat',
        serviceDetails: { test: 'reducing balance for insufficient credits test' }
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    }
    
    // Now try to use chat with 0 credits
    try {
      await axios.post(`${BASE_URL}/chat`, {
        messages: [
          { role: 'user', content: 'This should fail due to insufficient credits' }
        ]
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('❌ Insufficient credits test failed - request should have been rejected');
    } catch (error) {
      if (error.response && error.response.status === 402) {
        console.log('✅ Insufficient credits handling works correctly');
        console.log(`   Error: ${error.response.data.error}`);
        console.log(`   Message: ${error.response.data.message}`);
      } else {
        console.log('❌ Unexpected error in insufficient credits test:', error.response?.data);
      }
    }
    
    // Step 8: Test unauthenticated chat (should work without credit check)
    console.log('\n8️⃣ Testing unauthenticated chat (backward compatibility)...');
    try {
      const unauthResponse = await axios.post(`${BASE_URL}/chat`, {
        messages: [
          { role: 'user', content: 'This is an unauthenticated request' }
        ]
      });
      
      if (unauthResponse.data.success) {
        console.log('✅ Unauthenticated chat works (backward compatibility maintained)');
        console.log(`   Response: ${unauthResponse.data.response.substring(0, 50)}...`);
      } else {
        console.log('❌ Unauthenticated chat failed:', unauthResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Unauthenticated chat error:', error.response?.data?.error);
    }
    
    console.log('\n🎉 Chat credit integration testing completed!');
    
  } catch (error) {
    console.error('\n💥 Chat credit test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testChatCredits()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testChatCredits };
