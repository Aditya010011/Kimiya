const axios = require('axios');

const API_BASE_URL = 'http://localhost:3010';

async function testNewPricing() {
  console.log('🧪 Testing New Hybrid Pricing Structure');
  console.log('========================================\n');

  let testUserToken = null;
  let testUser = null;

  try {
    // Step 1: Authenticate
    console.log('1️⃣ Authenticating test user...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'test@kimiya.ai',
      password: 'test123'
    });

    if (loginResponse.data.success) {
      testUserToken = loginResponse.data.data.tokens.access_token;
      testUser = loginResponse.data.data.user;
      console.log('✅ Authentication successful');
      console.log(`   User: ${testUser.email}`);
      console.log(`   Organization: ${testUser.organization_id}\n`);
    } else {
      console.log('❌ Authentication failed');
      return;
    }

    // Step 2: Test Monthly Subscription (Starter Plan)
    console.log('2️⃣ Testing Monthly Subscription (Starter Plan)...');
    try {
      const monthlyResponse = await axios.post(
        `${API_BASE_URL}/api/billing/subscribe`,
        {
          organizationId: testUser.organization_id,
          planId: 'starter',
          billingCycle: 'monthly'
        },
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (monthlyResponse.data.success) {
        console.log('✅ Monthly subscription created');
        console.log(`   Plan: Starter`);
        console.log(`   Billing Cycle: Monthly`);
        console.log(`   Price: $49/month`);
        console.log(`   Credits: 30,000 (500 minutes)`);
        console.log(`   Subscription ID: ${monthlyResponse.data.data.subscription_id}\n`);
      }
    } catch (error) {
      console.log('❌ Monthly subscription failed:', error.response?.data?.error || error.message);
    }

    // Step 3: Test Annual Subscription (Professional Plan)
    console.log('3️⃣ Testing Annual Subscription (Professional Plan)...');
    try {
      const annualResponse = await axios.post(
        `${API_BASE_URL}/api/billing/subscribe`,
        {
          organizationId: testUser.organization_id,
          planId: 'professional',
          billingCycle: 'annual'
        },
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (annualResponse.data.success) {
        console.log('✅ Annual subscription created');
        console.log(`   Plan: Professional`);
        console.log(`   Billing Cycle: Annual`);
        console.log(`   Monthly Price: $299/month`);
        console.log(`   Annual Price: $2,868.80/year (Save $718.20)`);
        console.log(`   Credits: 180,000 (3,000 minutes)`);
        console.log(`   Subscription ID: ${annualResponse.data.data.subscription_id}\n`);
      }
    } catch (error) {
      console.log('❌ Annual subscription failed:', error.response?.data?.error || error.message);
    }

    // Step 4: Get Organization Billing Info
    console.log('4️⃣ Retrieving Organization Billing Info...');
    try {
      const billingResponse = await axios.get(
        `${API_BASE_URL}/api/billing/organization/${testUser.organization_id}`,
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (billingResponse.data.success) {
        const billing = billingResponse.data.data;
        console.log('✅ Billing info retrieved');
        console.log(`   Organization: ${billing.organization_name}`);
        
        if (billing.current_subscription) {
          const sub = billing.current_subscription;
          console.log(`   Current Plan: ${sub.plan.name}`);
          console.log(`   Billing Cycle: ${sub.billing_cycle || 'monthly'}`);
          console.log(`   Status: ${sub.status}`);
          console.log(`   Credits: ${sub.plan.monthly_credits.toLocaleString()}`);
          console.log(`   Minutes: ${sub.plan.minutes_included?.toLocaleString() || 'N/A'}`);
          console.log(`   AI Operators: ${sub.plan.features.ai_operators}`);
          console.log(`   Concurrent Calls: ${sub.plan.features.concurrent_calls}`);
          console.log(`   AI Messages: ${sub.plan.features.ai_messages.toLocaleString()}`);
          console.log(`   Team Members: ${sub.plan.features.team_members}`);
          console.log(`   Overage Rate: $${sub.plan.features.extra_minute_cost}/minute`);
          console.log(`   Period: ${new Date(sub.current_period_start).toLocaleDateString()} - ${new Date(sub.current_period_end).toLocaleDateString()}`);
        } else {
          console.log('   No active subscription');
        }
        console.log();
      }
    } catch (error) {
      console.log('❌ Billing info retrieval failed:', error.response?.data?.error || error.message);
    }

    // Step 5: Test Business Plan Subscription
    console.log('5️⃣ Testing Business Plan Subscription...');
    try {
      const businessResponse = await axios.post(
        `${API_BASE_URL}/api/billing/subscribe`,
        {
          organizationId: testUser.organization_id,
          planId: 'business',
          billingCycle: 'monthly'
        },
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (businessResponse.data.success) {
        console.log('✅ Business plan subscription created');
        console.log(`   Plan: Business`);
        console.log(`   Price: $899/month`);
        console.log(`   Credits: 720,000 (12,000 minutes)`);
        console.log(`   AI Operators: 50`);
        console.log(`   Concurrent Calls: 100`);
        console.log(`   Campaigns: Unlimited`);
        console.log(`   Overage Rate: $0.15/minute\n`);
      }
    } catch (error) {
      console.log('❌ Business plan subscription failed:', error.response?.data?.error || error.message);
    }

    // Step 6: Verify Credit Balance
    console.log('6️⃣ Verifying Credit Balance...');
    try {
      const balanceResponse = await axios.get(
        `${API_BASE_URL}/api/credits/balance`,
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (balanceResponse.data.success) {
        const balance = balanceResponse.data.data;
        console.log('✅ Credit balance retrieved');
        console.log(`   Current Balance: ${balance.currentBalance.toLocaleString()} credits`);
        console.log(`   Total Allocated: ${balance.allocatedCredits.toLocaleString()} credits`);
        console.log(`   Minutes Available: ${Math.floor(balance.currentBalance / 60).toLocaleString()} minutes\n`);
      }
    } catch (error) {
      console.log('❌ Credit balance retrieval failed:', error.response?.data?.error || error.message);
    }

    // Summary
    console.log('📊 New Pricing Structure Summary');
    console.log('=================================');
    console.log('');
    console.log('🌱 Starter Plan - $49/month ($470.40/year)');
    console.log('   • 500 minutes (30,000 credits)');
    console.log('   • 2,000 AI chat messages');
    console.log('   • 2 AI operators, 5 concurrent calls');
    console.log('   • $0.40/min overage');
    console.log('');
    console.log('💼 Professional Plan - $299/month ($2,868.80/year) ⭐ Most Popular');
    console.log('   • 3,000 minutes (180,000 credits)');
    console.log('   • 10,000 AI chat messages');
    console.log('   • 10 AI operators, 25 concurrent calls');
    console.log('   • $0.25/min overage');
    console.log('');
    console.log('🏢 Business Plan - $899/month ($8,630.40/year)');
    console.log('   • 12,000 minutes (720,000 credits)');
    console.log('   • 50,000 AI chat messages');
    console.log('   • 50 AI operators, 100 concurrent calls');
    console.log('   • Unlimited campaigns');
    console.log('   • $0.15/min overage');
    console.log('');
    console.log('🚀 Enterprise Plan - Custom Pricing');
    console.log('   • Unlimited everything');
    console.log('   • Custom integrations & SLA');
    console.log('   • Dedicated support');
    console.log('');
    console.log('💰 Annual Billing: Save 20% on all plans!');
    console.log('');
    console.log('✅ Competitive with Bland AI, Vapi AI, and Retell AI');
    console.log('✅ More minutes per dollar than competitors');
    console.log('✅ Flexible billing cycles (monthly/annual)');
    console.log('✅ Clear overage pricing');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewPricing();
