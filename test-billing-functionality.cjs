const axios = require('axios');

const API_BASE_URL = 'http://localhost:3010';

async function testBillingFunctionality() {
  console.log('🧪 Testing Complete Billing Functionality');
  console.log('=========================================\n');

  let adminToken = null;
  let testUserToken = null;
  let testUser = null;

  try {
    // Step 1: Authenticate as admin
    console.log('1️⃣ Admin Authentication...');
    try {
      const adminLoginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'admin@kimiyavoice.com',
        password: 'Admin123!'
      });

      if (adminLoginResponse.data.success) {
        adminToken = adminLoginResponse.data.data.tokens.access_token;
        console.log('✅ Admin login successful');
      } else {
        console.log('❌ Admin login failed:', adminLoginResponse.data.error);
        return;
      }
    } catch (error) {
      console.log('❌ Admin login error:', error.response?.data?.error || error.message);
      return;
    }

    // Step 2: Authenticate as test user
    console.log('\n2️⃣ Test User Authentication...');
    try {
      const testLoginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'test@kimiya.ai',
        password: 'test123'
      });

      if (testLoginResponse.data.success) {
        testUserToken = testLoginResponse.data.data.tokens.access_token;
        testUser = testLoginResponse.data.data.user;
        console.log('✅ Test user login successful');
        console.log(`   User ID: ${testUser.id}`);
        console.log(`   Organization ID: ${testUser.organization_id}`);
      } else {
        console.log('❌ Test user login failed:', testLoginResponse.data.error);
        return;
      }
    } catch (error) {
      console.log('❌ Test user login error:', error.response?.data?.error || error.message);
      return;
    }

    // Step 3: Test Organization Billing Info
    console.log('\n3️⃣ Testing Organization Billing Info...');
    try {
      const billingResponse = await axios.get(
        `${API_BASE_URL}/api/billing/organization/${testUser.organization_id}`,
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (billingResponse.data.success) {
        console.log('✅ Organization billing info retrieved');
        const billing = billingResponse.data.data;
        console.log(`   Organization: ${billing.organization_name}`);
        console.log(`   Current Subscription: ${billing.current_subscription ? billing.current_subscription.plan.name : 'None'}`);
        console.log(`   Payment Methods: ${billing.payment_methods.length}`);
        console.log(`   Billing History: ${billing.billing_history.length} records`);
        console.log(`   Upcoming Invoice: ${billing.upcoming_invoice ? '$' + billing.upcoming_invoice.amount_usd : 'None'}`);
      } else {
        console.log('❌ Organization billing info failed:', billingResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Organization billing info error:', error.response?.data?.error || error.message);
    }

    // Step 4: Test Create Subscription
    console.log('\n4️⃣ Testing Create Subscription...');
    try {
      const subscribeResponse = await axios.post(
        `${API_BASE_URL}/api/billing/subscribe`,
        {
          organizationId: testUser.organization_id,
          planId: 'basic'
        },
        {
          headers: { 
            'Authorization': `Bearer ${testUserToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (subscribeResponse.data.success) {
        console.log('✅ Subscription created successfully');
        const subscription = subscribeResponse.data.data;
        console.log(`   Subscription ID: ${subscription.subscription_id}`);
        console.log(`   Plan: ${subscription.plan_id}`);
        console.log(`   Status: ${subscription.status}`);
        console.log(`   Message: ${subscription.message}`);
      } else {
        console.log('❌ Subscription creation failed:', subscribeResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Subscription creation error:', error.response?.data?.error || error.message);
    }

    // Step 5: Test Add Payment Method
    console.log('\n5️⃣ Testing Add Payment Method...');
    try {
      const paymentResponse = await axios.post(
        `${API_BASE_URL}/api/billing/payment-methods`,
        {
          organizationId: testUser.organization_id,
          type: 'card',
          last_four: '4242',
          brand: 'visa',
          exp_month: 12,
          exp_year: 2025,
          is_default: true
        },
        {
          headers: { 
            'Authorization': `Bearer ${testUserToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (paymentResponse.data.success) {
        console.log('✅ Payment method added successfully');
        const payment = paymentResponse.data.data;
        console.log(`   Payment Method ID: ${payment.id}`);
        console.log(`   Type: ${payment.type}`);
        console.log(`   Last Four: ${payment.last_four}`);
        console.log(`   Brand: ${payment.brand}`);
        console.log(`   Is Default: ${payment.is_default}`);
      } else {
        console.log('❌ Payment method addition failed:', paymentResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Payment method addition error:', error.response?.data?.error || error.message);
    }

    // Step 6: Test Get Payment Methods
    console.log('\n6️⃣ Testing Get Payment Methods...');
    try {
      const paymentMethodsResponse = await axios.get(
        `${API_BASE_URL}/api/billing/payment-methods/${testUser.organization_id}`,
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (paymentMethodsResponse.data.success) {
        console.log('✅ Payment methods retrieved successfully');
        const methods = paymentMethodsResponse.data.data;
        console.log(`   Total Payment Methods: ${methods.length}`);
        methods.forEach((method, index) => {
          console.log(`   ${index + 1}. ${method.brand} **** ${method.last_four} (${method.is_default ? 'Default' : 'Not Default'})`);
        });
      } else {
        console.log('❌ Payment methods retrieval failed:', paymentMethodsResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Payment methods retrieval error:', error.response?.data?.error || error.message);
    }

    // Step 7: Test Change Plan
    console.log('\n7️⃣ Testing Change Plan...');
    try {
      const changePlanResponse = await axios.post(
        `${API_BASE_URL}/api/billing/change-plan`,
        {
          organizationId: testUser.organization_id,
          newPlanId: 'professional',
          effectiveDate: 'immediate'
        },
        {
          headers: { 
            'Authorization': `Bearer ${testUserToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (changePlanResponse.data.success) {
        console.log('✅ Plan changed successfully');
        const planChange = changePlanResponse.data.data;
        console.log(`   New Plan: ${planChange.new_plan_id}`);
        console.log(`   Effective Date: ${planChange.effective_date}`);
        console.log(`   Message: ${planChange.message}`);
      } else {
        console.log('❌ Plan change failed:', changePlanResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Plan change error:', error.response?.data?.error || error.message);
    }

    // Step 8: Test Get Billing History
    console.log('\n8️⃣ Testing Get Billing History...');
    try {
      const historyResponse = await axios.get(
        `${API_BASE_URL}/api/billing/history/${testUser.organization_id}?limit=5`,
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (historyResponse.data.success) {
        console.log('✅ Billing history retrieved successfully');
        const history = historyResponse.data.data;
        console.log(`   Total Records: ${history.length}`);
        history.forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.invoice_number} - $${record.amount_usd} (${record.status})`);
          console.log(`      Plan: ${record.plan_name}`);
          console.log(`      Period: ${record.billing_period_start} to ${record.billing_period_end}`);
        });
      } else {
        console.log('❌ Billing history retrieval failed:', historyResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Billing history retrieval error:', error.response?.data?.error || error.message);
    }

    // Step 9: Test Cancel Subscription
    console.log('\n9️⃣ Testing Cancel Subscription...');
    try {
      const cancelResponse = await axios.post(
        `${API_BASE_URL}/api/billing/cancel`,
        {
          organizationId: testUser.organization_id,
          cancelAtPeriodEnd: true
        },
        {
          headers: { 
            'Authorization': `Bearer ${testUserToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (cancelResponse.data.success) {
        console.log('✅ Subscription cancelled successfully');
        const cancellation = cancelResponse.data.data;
        console.log(`   Status: ${cancellation.status}`);
        console.log(`   Cancel at Period End: ${cancellation.cancel_at_period_end}`);
        console.log(`   Message: ${cancellation.message}`);
      } else {
        console.log('❌ Subscription cancellation failed:', cancelResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Subscription cancellation error:', error.response?.data?.error || error.message);
    }

    // Step 10: Verify Credit Allocation After Subscription
    console.log('\n🔟 Testing Credit Allocation After Subscription...');
    try {
      const balanceResponse = await axios.get(
        `${API_BASE_URL}/api/credits/balance`,
        {
          headers: { 'Authorization': `Bearer ${testUserToken}` }
        }
      );

      if (balanceResponse.data.success) {
        console.log('✅ Credit balance retrieved after subscription');
        const balance = balanceResponse.data.data;
        console.log(`   Current Balance: ${balance.currentBalance} credits`);
        console.log(`   Total Allocated: ${balance.allocatedCredits} credits`);
        console.log(`   Reserved: ${balance.reservedCredits} credits`);
      } else {
        console.log('❌ Credit balance retrieval failed:', balanceResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Credit balance retrieval error:', error.response?.data?.error || error.message);
    }

    console.log('\n🎉 Billing Functionality Test Complete!');
    console.log('=======================================');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

testBillingFunctionality();
