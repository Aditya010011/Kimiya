/**
 * Debug webhook object structure
 */

require('dotenv').config({ path: './backend/.env.development' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function debugWebhook() {
  try {
    console.log(`\n🔍 Debugging Webhook Object\n`);

    // List all webhooks
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    
    const ourWebhook = endpoints.data.find(e => 
      e.url.includes('dev-ai-phone-call.kimiyi.ai/api/stripe/webhook')
    );

    if (!ourWebhook) {
      console.error(`❌ Webhook endpoint not found!`);
      process.exit(1);
    }

    console.log(`📊 Full Webhook Object:`);
    console.log(JSON.stringify(ourWebhook, null, 2));

    console.log(`\n📋 Webhook Properties:`);
    Object.keys(ourWebhook).forEach(key => {
      console.log(`   ${key}: ${ourWebhook[key]}`);
    });

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    process.exit(1);
  }
}

debugWebhook();

