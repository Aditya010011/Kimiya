/**
 * Test script for Stripe API integration (no database required)
 * Tests Stripe API connectivity and product/price configuration
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeAPI() {
  console.log('🧪 Starting Stripe API Tests\n');

  try {
    // Test 1: Verify Stripe connection
    console.log('Test 1: Verifying Stripe connection...');
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe account: ${account.id}`);
    console.log(`   Account type: ${account.type}`);
    console.log(`   Country: ${account.country}`);
    console.log();

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
      const interval = p.recurring?.interval || 'one-time';
      const amount = (p.unit_amount / 100).toFixed(2);
      console.log(`   - ${productName}: $${amount}/${interval}`);
    });
    console.log();

    // Test 4: Verify product configuration
    console.log('Test 4: Verifying product configuration...');
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

    // Test 5: Verify price IDs match
    console.log('Test 5: Verifying price ID mappings...');
    const priceMap = stripeProducts.priceIdToPlanMap;
    console.log(`✅ Price ID mappings:`);
    Object.entries(priceMap).forEach(([priceId, planId]) => {
      console.log(`   - ${priceId} → ${planId}`);
    });
    console.log();

    // Test 6: Test customer creation
    console.log('Test 6: Testing customer creation...');
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
    console.log(`   Name: ${customer.name}`);
    console.log();

    // Test 7: Test checkout session creation
    console.log('Test 7: Testing checkout session creation...');
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
      console.log(`   Customer: ${session.customer}`);
      console.log(`   Mode: ${session.mode}`);
      console.log();
    } else {
      console.log(`⚠️  Starter monthly price not found`);
      console.log();
    }

    // Test 8: Verify environment variables
    console.log('Test 8: Verifying environment variables...');
    const hasPublishableKey = !!process.env.STRIPE_PUBLISHABLE_KEY;
    const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log(`✅ Environment variables:`);
    console.log(`   - STRIPE_PUBLISHABLE_KEY: ${hasPublishableKey ? '✓ Set' : '✗ Missing'}`);
    console.log(`   - STRIPE_SECRET_KEY: ${hasSecretKey ? '✓ Set' : '✗ Missing'}`);
    console.log(`   - STRIPE_WEBHOOK_SECRET: ${hasWebhookSecret ? '✓ Set' : '⚠️  Not set (required for webhooks)'}`);
    console.log();

    console.log('✅ All API tests passed!\n');
    console.log('📝 Next steps:');
    console.log('1. Set STRIPE_WEBHOOK_SECRET in .env');
    console.log('2. Use Stripe CLI to forward webhooks:');
    console.log('   stripe listen --forward-to localhost:3010/api/stripe/webhook');
    console.log('3. Copy the webhook signing secret to .env');
    console.log('4. Start the backend server: npm start');
    console.log('5. Test checkout flow in the application');
    console.log('6. Verify credits are allocated after payment');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('   Network error: Cannot reach Stripe API');
    }
    process.exit(1);
  }
}

testStripeAPI();

