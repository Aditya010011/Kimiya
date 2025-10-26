/**
 * Check Stripe webhook endpoints configuration
 * Lists all webhook endpoints and their status
 */

require('dotenv').config({ path: './backend/.env.development' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkWebhooks() {
  try {
    console.log(`\n🔍 Checking Stripe Webhook Endpoints\n`);
    console.log(`📊 Stripe Account: ${process.env.STRIPE_SECRET_KEY.substring(0, 20)}...`);
    console.log(`🎯 Expected Webhook URL: https://dev-ai-phone-call.kimiyi.ai/api/stripe/webhook\n`);

    // List all webhook endpoints
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

    if (!endpoints.data || endpoints.data.length === 0) {
      console.log(`❌ NO WEBHOOK ENDPOINTS FOUND!\n`);
      console.log(`⚠️  You need to create a webhook endpoint in Stripe Dashboard:`);
      console.log(`   1. Go to https://dashboard.stripe.com/webhooks`);
      console.log(`   2. Click "Add endpoint"`);
      console.log(`   3. Enter URL: https://dev-ai-phone-call.kimiyi.ai/api/stripe/webhook`);
      console.log(`   4. Select events: checkout.session.completed, customer.subscription.updated, invoice.payment_succeeded`);
      console.log(`   5. Click "Add endpoint"\n`);
      return;
    }

    console.log(`✅ Found ${endpoints.data.length} webhook endpoint(s):\n`);

    endpoints.data.forEach((endpoint, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📍 Endpoint ${index + 1}:`);
      console.log(`   ID: ${endpoint.id}`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Status: ${endpoint.status === 'enabled' ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`   Created: ${new Date(endpoint.created * 1000).toISOString()}`);
      console.log(`   Events: ${endpoint.enabled_events.join(', ')}`);
      console.log(`   API Version: ${endpoint.api_version || 'default'}`);

      // Check if this is our webhook
      if (endpoint.url.includes('dev-ai-phone-call.kimiyi.ai/api/stripe/webhook')) {
        console.log(`\n   ✅ THIS IS OUR WEBHOOK!`);
        if (endpoint.status !== 'enabled') {
          console.log(`   ⚠️  WARNING: This webhook is DISABLED!`);
        }
        if (!endpoint.enabled_events.includes('checkout.session.completed')) {
          console.log(`   ⚠️  WARNING: Not subscribed to checkout.session.completed!`);
        }
      }
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Check if our webhook exists
    const ourWebhook = endpoints.data.find(e =>
      e.url.includes('dev-ai-phone-call.kimiyi.ai/api/stripe/webhook')
    );

    if (!ourWebhook) {
      console.log(`❌ WEBHOOK NOT FOUND: https://dev-ai-phone-call.kimiyi.ai/api/stripe/webhook\n`);
      console.log(`📋 Existing webhooks:`);
      endpoints.data.forEach(e => console.log(`   - ${e.url}`));
      console.log(`\n⚠️  You need to create the webhook endpoint!\n`);
    } else {
      console.log(`✅ Webhook found and configured!\n`);
      if (ourWebhook.status === 'enabled') {
        console.log(`✅ Status: ENABLED`);
      } else {
        console.log(`❌ Status: DISABLED - Need to enable it!`);
      }
    }

  } catch (error) {
    console.error(`❌ Error checking webhooks:`, error.message);
    process.exit(1);
  }
}

checkWebhooks();