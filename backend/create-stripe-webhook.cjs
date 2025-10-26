/**
 * Create Stripe webhook endpoint
 * This script creates the webhook endpoint in Stripe for receiving events
 */

require('dotenv').config({ path: './backend/.env.development' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createWebhook() {
  try {
    console.log(`\n🔧 Creating Stripe Webhook Endpoint\n`);

    const webhookUrl = 'https://dev-ai-phone-call.kimiyi.ai/api/stripe/webhook';
    const enabledEvents = [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ];

    console.log(`📍 Webhook URL: ${webhookUrl}`);
    console.log(`📋 Events to subscribe to:`);
    enabledEvents.forEach(event => console.log(`   - ${event}`));
    console.log();

    // Create the webhook endpoint
    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: enabledEvents,
      description: 'Kimiya Voice AI - Credit Allocation & Subscription Management'
    });

    console.log(`✅ Webhook endpoint created successfully!\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Webhook Details:`);
    console.log(`   ID: ${endpoint.id}`);
    console.log(`   URL: ${endpoint.url}`);
    console.log(`   Status: ${endpoint.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Created: ${new Date(endpoint.created * 1000).toISOString()}`);
    console.log(`   Signing Secret: ${endpoint.secret}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`⚠️  IMPORTANT: Update your .env.development file with the signing secret:\n`);
    console.log(`   STRIPE_WEBHOOK_SECRET=${endpoint.secret}\n`);

    console.log(`✅ Webhook is now ready to receive events from Stripe!`);
    console.log(`✅ Credits will be allocated automatically when payments are completed.\n`);

  } catch (error) {
    console.error(`❌ Error creating webhook:`, error.message);
    if (error.code === 'resource_already_exists') {
      console.error(`\n⚠️  Webhook endpoint already exists!`);
    }
    process.exit(1);
  }
}

createWebhook();

