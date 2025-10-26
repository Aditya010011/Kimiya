/**
 * Enable Stripe webhook endpoint using raw API call
 */

require('dotenv').config({ path: './backend/.env.development' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function enableWebhook() {
  try {
    console.log(`\n🔧 Enabling Stripe Webhook Endpoint (Raw API)\n`);

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
    console.log(`   Current Status: ${ourWebhook.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n`);

    // Try using the raw request method
    const updated = await stripe.request({
      method: 'POST',
      path: `/v1/webhook_endpoints/${ourWebhook.id}`,
      data: {
        disabled: false
      }
    });

    console.log(`✅ Webhook endpoint enabled successfully!\n`);
    console.log(`📊 Updated Status: ${updated.disabled ? '❌ DISABLED' : '✅ ENABLED'}`);
    console.log(`📊 Webhook ID: ${updated.id}\n`);

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    console.error(`Details:`, error);
    process.exit(1);
  }
}

enableWebhook();

