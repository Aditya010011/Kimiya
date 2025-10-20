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
 * Test the credit API endpoints
 */
async function testCreditAPI() {
  console.log('🧪 Testing Credit API Endpoints...\n');
  
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
    
    // Step 2: Get credit balance (should initialize if not exists)
    console.log('\n2️⃣ Getting credit balance...');
    const balanceResponse = await axios.get(`${BASE_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (balanceResponse.data.success) {
      console.log('✅ Credit balance retrieved:');
      console.log(`   Current Balance: ${balanceResponse.data.data.currentBalance}`);
      console.log(`   Allocated Credits: ${balanceResponse.data.data.allocatedCredits}`);
      console.log(`   Used Credits: ${balanceResponse.data.data.usedCredits}`);
    } else {
      console.log('❌ Failed to get credit balance:', balanceResponse.data.error);
    }
    
    // Step 3: Allocate credits (admin function)
    console.log('\n3️⃣ Allocating credits (admin)...');
    const allocateResponse = await axios.post(`${BASE_URL}/credits/admin/allocate`, {
      userId: userId,
      amount: 1000,
      notes: 'Initial credit allocation for testing'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (allocateResponse.data.success) {
      console.log('✅ Credits allocated successfully:');
      console.log(`   Amount: ${allocateResponse.data.data.amountAllocated}`);
      console.log(`   Balance Before: ${allocateResponse.data.data.balanceBefore}`);
      console.log(`   Balance After: ${allocateResponse.data.data.balanceAfter}`);
    } else {
      console.log('❌ Failed to allocate credits:', allocateResponse.data.error);
    }
    
    // Step 4: Deduct credits (simulate chat usage)
    console.log('\n4️⃣ Deducting credits (chat usage)...');
    const deductResponse = await axios.post(`${BASE_URL}/credits/deduct`, {
      amount: 5,
      serviceType: 'chat',
      serviceDetails: {
        messageId: 'msg_test_123',
        messageContent: 'Hello, this is a test message',
        tokensUsed: 15
      },
      referenceId: 'msg_test_123',
      referenceType: 'chat_message'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (deductResponse.data.success) {
      console.log('✅ Credits deducted successfully:');
      console.log(`   Amount Deducted: ${deductResponse.data.data.amountDeducted}`);
      console.log(`   Balance Before: ${deductResponse.data.data.balanceBefore}`);
      console.log(`   Balance After: ${deductResponse.data.data.balanceAfter}`);
      console.log(`   Service Type: ${deductResponse.data.data.serviceType}`);
    } else {
      console.log('❌ Failed to deduct credits:', deductResponse.data.error);
    }
    
    // Step 5: Get updated balance
    console.log('\n5️⃣ Getting updated credit balance...');
    const updatedBalanceResponse = await axios.get(`${BASE_URL}/credits/balance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (updatedBalanceResponse.data.success) {
      console.log('✅ Updated credit balance:');
      console.log(`   Current Balance: ${updatedBalanceResponse.data.data.currentBalance}`);
      console.log(`   Used Credits: ${updatedBalanceResponse.data.data.usedCredits}`);
      console.log(`   Monthly Used: ${updatedBalanceResponse.data.data.monthlyUsed}`);
    } else {
      console.log('❌ Failed to get updated balance:', updatedBalanceResponse.data.error);
    }
    
    // Step 6: Get transaction history
    console.log('\n6️⃣ Getting transaction history...');
    const transactionsResponse = await axios.get(`${BASE_URL}/credits/transactions?limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (transactionsResponse.data.success) {
      console.log('✅ Transaction history retrieved:');
      console.log(`   Total Transactions: ${transactionsResponse.data.data.pagination.total}`);
      console.log('   Recent Transactions:');
      
      transactionsResponse.data.data.transactions.forEach((tx, index) => {
        console.log(`     ${index + 1}. ${tx.type.toUpperCase()} - ${tx.amount} credits (${tx.serviceType})`);
        console.log(`        Balance: ${tx.balanceBefore} → ${tx.balanceAfter}`);
        console.log(`        Date: ${new Date(tx.createdAt).toLocaleString()}`);
      });
    } else {
      console.log('❌ Failed to get transaction history:', transactionsResponse.data.error);
    }
    
    // Step 7: Test insufficient credits scenario
    console.log('\n7️⃣ Testing insufficient credits scenario...');
    try {
      await axios.post(`${BASE_URL}/credits/deduct`, {
        amount: 10000, // More than available balance
        serviceType: 'chat',
        serviceDetails: { test: 'insufficient credits test' }
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      console.log('❌ Insufficient credits handling failed - should have been rejected');
    } catch (error) {
      if (error.response && error.response.status === 402 &&
          error.response.data.error === 'Insufficient credits') {
        console.log('✅ Insufficient credits handling works correctly');
        console.log(`   Required: ${error.response.data.requiredAmount}`);
        console.log(`   Available: ${error.response.data.currentBalance}`);
      } else {
        console.log('❌ Insufficient credits handling failed with unexpected error');
        console.log('   Status:', error.response?.status);
        console.log('   Error:', error.response?.data?.error);
      }
    }
    
    console.log('\n🎉 Credit API testing completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Credit API test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testCreditAPI()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCreditAPI };
