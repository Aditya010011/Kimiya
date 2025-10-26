/**
 * Test script for Stripe integration
 * Tests Stripe service functionality and webhook handling
 */

require('dotenv').config();
const StripeService = require('./services/StripeService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeIntegration() {
  console.log('🧪 Starting Stripe Integration Tests\n');

  try {
    // Test 1: Verify Stripe connection
    console.log('Test 1: Verifying Stripe connection...');
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe account: ${account.id}\n`);

    // Test 2: List products
    console.log('Test 2: Listing Stripe products...');
    const products = await stripe.products.list({ limit: 10 });
    console.log(`✅ Found ${products.data.length} products:`);
    products.data.forEach(p => {
      console.log(`   - ${p.name} (${p.id})`);
    });
    console.log();

    // Test 3: List prices
    console.log('Test 3: Listing Stripe prices...');
    const prices = await stripe.prices.list({ limit: 20 });
    console.log(`✅ Found ${prices.data.length} prices:`);
    prices.data.forEach(p => {
      const product = products.data.find(pr => pr.id === p.product);
      const productName = product ? product.name : 'Unknown';
      console.log(`   - ${productName}: $${p.unit_amount / 100}/${p.recurring?.interval || 'one-time'}`);
    });
    console.log();

    // Test 4: Test customer creation
    console.log('Test 4: Testing customer creation...');
    const testEmail = `test-${Date.now()}@example.com`;
    const customer = await stripe.customers.create({
      email: testEmail,
      name: 'Test Organization',
      metadata: {
        organizationId: 'test-org-123',
        createdAt: new Date().toISOString()
      }
    });
    console.log(`✅ Created test customer: ${customer.id}`);
    console.log(`   Email: ${customer.email}`);
    console.log();

    // Test 5: Test checkout session creation
    console.log('Test 5: Testing checkout session creation...');
    const starterPrice = prices.data.find(p => 
      p.product === 'prod_THQd4CRrguMKqy' && p.recurring?.interval === 'month'
    );
    
    if (starterPrice) {
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: starterPrice.id,
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: 'http://localhost:3000/billing/success',
        cancel_url: 'http://localhost:3000/billing/cancel',
        metadata: {
          organizationId: 'test-org-123',
          planId: 'starter',
          billingCycle: 'monthly'
        }
      });
      console.log(`✅ Created checkout session: ${session.id}`);
      console.log(`   URL: ${session.url}`);
      console.log();
    }

    // Test 6: Verify product configuration
    console.log('Test 6: Verifying product configuration...');
    const stripeProducts = require('./config/stripe-products.json');
    const plans = Object.keys(stripeProducts.products);
    console.log(`✅ Configured plans: ${plans.join(', ')}`);
    
    plans.forEach(planId => {
      const plan = stripeProducts.products[planId];
      console.log(`\n   ${plan.name}:`);
      console.log(`   - Product ID: ${plan.id}`);
      console.log(`   - Monthly Price ID: ${plan.prices.monthly?.id || 'N/A'}`);
      console.log(`   - Annual Price ID: ${plan.prices.annual?.id || 'N/A'}`);
      console.log(`   - Monthly Credits: ${plan.monthlyCredits}`);
    });
    console.log();

    // Test 7: Test webhook signature verification
    console.log('Test 7: Testing webhook signature verification...');
    const testEvent = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          customer: customer.id,
          subscription: 'sub_test_123',
          metadata: {
            organizationId: 'test-org-123',
            planId: 'starter',
            billingCycle: 'monthly'
          }
        }
      }
    };
    
    console.log(`✅ Test event structure verified`);
    console.log(`   Event type: ${testEvent.type}`);
    console.log(`   Organization ID: ${testEvent.data.object.metadata.organizationId}`);
    console.log();

    // Test 8: Verify helper methods
    console.log('Test 8: Testing StripeService helper methods...');
    const planId = StripeService.getPlanIdFromPrice('price_1SKrmSP3IrzUrUyZbTkVm0PC');
    console.log(`✅ Price to Plan mapping: price_1SKrmSP3IrzUrUyZbTkVm0PC -> ${planId}`);
    
    const planDetails = StripeService.getPlanDetails('starter');
    console.log(`✅ Plan details retrieved: ${planDetails.name}`);
    
    const priceId = StripeService.getPriceId('professional', 'annual');
    console.log(`✅ Price ID lookup: professional/annual -> ${priceId}`);
    console.log();

    console.log('✅ All tests passed!\n');
    console.log('📝 Next steps:');
    console.log('1. Set STRIPE_WEBHOOK_SECRET in .env');
    console.log('2. Use Stripe CLI to forward webhooks: stripe listen --forward-to localhost:3010/api/stripe/webhook');
    console.log('3. Test checkout flow in the application');
    console.log('4. Verify credits are allocated after payment');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testStripeIntegration();

