/**
 * Enable Stripe webhook endpoint
 * This script enables the webhook endpoint so it can receive events
 */

require('dotenv').config({ path: './backend/.env.development' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function enableWebhook() {
  try {
    console.log(`\n🔧 Enabling Stripe Webhook Endpoint\n`);

    // List all webhooks to find ours
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    
    const ourWebhook = endpoints.data.find(e => 
      e.url.includes('dev-ai-phone-call.kimiyi.ai/api/stripe/webhook')
    );

    if (!ourWebhook) {
      console.error(`❌ Webhook endpoint not found!`);
      process.exit(1);
    }

    console.log(`📍 Found webhook: ${ourWebhook.id}`);
    console.log(`   URL: ${ourWebhook.url}`);
    console.log(`   Current Status: ${ourWebhook.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n`);

    if (ourWebhook.enabled) {
      console.log(`✅ Webhook is already enabled!\n`);
      return;
    }

    // Enable the webhook (set disabled to false)
    const updated = await stripe.webhookEndpoints.update(ourWebhook.id, {
      disabled: false
    });

    console.log(`✅ Webhook endpoint enabled successfully!\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Updated Webhook Details:`);
    console.log(`   ID: ${updated.id}`);
    console.log(`   URL: ${updated.url}`);
    console.log(`   Status: ${updated.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Events: ${updated.enabled_events.join(', ')}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`✅ Webhook is now ACTIVE and ready to receive events from Stripe!`);
    console.log(`✅ Credits will be allocated automatically when payments are completed.\n`);

  } catch (error) {
    console.error(`❌ Error enabling webhook:`, error.message);
    process.exit(1);
  }
}

enableWebhook();

