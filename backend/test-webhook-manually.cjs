/**
 * Manual webhook test script
 * This script sends a test webhook event to your endpoint to verify it's working
 */

require('dotenv').config({ path: './backend/.env.development' });
const crypto = require('crypto');
const https = require('https');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL;

if (!STRIPE_WEBHOOK_SECRET || !WEBHOOK_URL) {
  console.error('❌ Missing STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_URL in .env');
  process.exit(1);
}

console.log(`🧪 Testing Webhook Endpoint`);
console.log(`   Webhook URL: ${WEBHOOK_URL}`);
console.log(`   Webhook Secret: ${STRIPE_WEBHOOK_SECRET.substring(0, 20)}...`);

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
      customer: 'cus_test_' + Date.now(),
      subscription: 'sub_test_' + Date.now(),
      metadata: {
        organizationId: 'org_default_123',
        planId: 'starter',
        billingCycle: 'monthly'
      },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2592000
    }
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: null,
    idempotency_key: null
  },
  type: 'checkout.session.completed'
};

const payload = JSON.stringify(testEvent);

// Generate signature
const timestamp = Math.floor(Date.now() / 1000);
const signedContent = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
  .update(signedContent)
  .digest('hex');
const stripeSignature = `t=${timestamp},v1=${signature}`;

console.log(`\n📤 Sending test webhook event...`);
console.log(`   Event ID: ${testEvent.id}`);
console.log(`   Event Type: ${testEvent.type}`);
console.log(`   Signature: ${stripeSignature.substring(0, 30)}...`);

// Parse URL
const url = new URL(WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': stripeSignature,
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\n✅ Response received:`);
    console.log(`   Status: ${res.statusCode}`);
    console.log(`   Headers: ${JSON.stringify(res.headers)}`);
    console.log(`   Body: ${data}`);

    if (res.statusCode === 200) {
      console.log(`\n✅ Webhook endpoint is working correctly!`);
    } else {
      console.log(`\n❌ Webhook endpoint returned error status: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.error(`\n❌ Error sending webhook:`, error.message);
  process.exit(1);
});

req.write(payload);
req.end();

