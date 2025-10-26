/**
 * Test webhook delivery by sending a test event from Stripe
 */

require('dotenv').config({ path: './backend/.env.development' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testWebhookDelivery() {
  try {
    console.log(`\n🧪 Testing Webhook Delivery\n`);

    // Get the webhook endpoint
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const ourWebhook = endpoints.data.find(e => 
      e.url.includes('dev-ai-phone-call.kimiyi.ai/api/stripe/webhook')
    );

    if (!ourWebhook) {
      console.error(`❌ Webhook endpoint not found!`);
      process.exit(1);
    }

    console.log(`📍 Webhook ID: ${ourWebhook.id}`);
    console.log(`📍 Webhook URL: ${ourWebhook.url}`);
    console.log(`📍 Status: ${ourWebhook.status}\n`);

    // Create a test event
    console.log(`📤 Sending test checkout.session.completed event...\n`);

    // We'll use the Stripe API to trigger a test event
    // First, let's create a test checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1SKcB8P3IrzUrUyZKee7iGR8', // Use a test price
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://dev-ai-phone-call.kimiyi.ai/success',
      cancel_url: 'https://dev-ai-phone-call.kimiyi.ai/cancel',
      metadata: {
        organizationId: 'org_test_123',
        planId: 'starter',
        billingCycle: 'monthly'
      }
    });

    console.log(`✅ Test checkout session created: ${session.id}`);
    console.log(`   Amount: ${session.amount_total / 100} ${session.currency.toUpperCase()}`);
    console.log(`   Status: ${session.payment_status}\n`);

    console.log(`⏳ Waiting for webhook event to be delivered...\n`);
    console.log(`📝 Check backend logs for: 🔔 WEBHOOK ENDPOINT HIT\n`);

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    process.exit(1);
  }
}

testWebhookDelivery();

