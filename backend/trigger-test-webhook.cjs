/**
 * Trigger a test webhook event using Stripe API
 * This simulates what Stripe would send when a real payment is completed
 */

require('dotenv').config({ path: './backend/.env.development' });
const https = require('https');
const crypto = require('crypto');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const WEBHOOK_URL = 'https://dev-ai-phone-call.kimiyi.ai/api/stripe/webhook';

// Create a test checkout.session.completed event
const testEvent = {
  id: 'evt_test_' + Date.now(),
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'cs_test_' + Date.now(),
      object: 'checkout.session',
      after_expiration: null,
      allow_promotion_codes: null,
      amount_subtotal: 2999,
      amount_total: 2999,
      automatic_tax: { enabled: false, status: null },
      billing_address_collection: null,
      cancel_url: 'https://dev-ai-phone-call.kimiyi.ai/cancel',
      client_reference_id: null,
      consent: null,
      consent_collection: null,
      currency: 'usd',
      customer: 'cus_test_' + Date.now(),
      customer_creation: 'if_required',
      customer_email: 'test@example.com',
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      livemode: false,
      locale: null,
      metadata: {
        organizationId: 'org_default_123',
        planId: 'starter',
        billingCycle: 'monthly'
      },
      mode: 'payment',
      payment_intent: 'pi_test_' + Date.now(),
      payment_link: null,
      payment_method_collection: 'if_required',
      payment_method_types: ['card'],
      payment_status: 'paid',
      phone_number_collection: { enabled: false },
      recovered_from: null,
      setup_intent: null,
      status: 'complete',
      submit_type: null,
      subscription: null,
      success_url: 'https://dev-ai-phone-call.kimiyi.ai/success',
      total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
      url: null
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: 'checkout.session.completed'
};

function generateStripeSignature(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedContent)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function sendWebhook() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(testEvent);
    const signature = generateStripeSignature(payload);

    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Stripe-Signature': signature,
        'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
      }
    };

    console.log(`\n🧪 Sending Test Webhook Event\n`);
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`📋 Event Type: checkout.session.completed`);
    console.log(`📋 Event ID: ${testEvent.id}`);
    console.log(`📋 Signature: ${signature.substring(0, 30)}...\n`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ Response Status: ${res.statusCode}`);
        console.log(`✅ Response Body: ${data}\n`);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Error sending webhook:`, error.message);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  try {
    await sendWebhook();
    console.log(`✅ Test webhook sent successfully!`);
    console.log(`📝 Check backend logs for: 🔔 WEBHOOK ENDPOINT HIT\n`);
  } catch (error) {
    console.error(`❌ Failed to send test webhook:`, error.message);
    process.exit(1);
  }
}

main();

