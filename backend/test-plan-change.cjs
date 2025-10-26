/**
 * Test plan change webhook (Starter → Business)
 */

require('dotenv').config({ path: './backend/.env.development' });
const http = require('http');
const crypto = require('crypto');

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const WEBHOOK_URL = 'http://localhost:3010/api/stripe/webhook';

// Create a test checkout.session.completed event for plan change
const testEvent = {
  id: 'evt_test_plan_change_' + Date.now(),
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'cs_test_plan_change_' + Date.now(),
      object: 'checkout.session',
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        organizationId: 'org_default_123',
        planId: 'business',  // Changed from 'starter' to 'business'
        billingCycle: 'monthly'
      }
    }
  },
  livemode: false,
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
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Stripe-Signature': signature,
        'User-Agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
      }
    };

    console.log(`\n🧪 Testing Plan Change Webhook (Starter → Business)\n`);
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`📋 Event Type: checkout.session.completed`);
    console.log(`📋 Event ID: ${testEvent.id}`);
    console.log(`📋 Old Plan: starter (30,000 credits)`);
    console.log(`📋 New Plan: business (720,000 credits)`);
    console.log(`📋 Signature: ${signature.substring(0, 30)}...\n`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✅ Response Status: ${res.statusCode}`);
        if (data) {
          console.log(`✅ Response Body: ${data}`);
        }
        console.log();
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
    console.log(`✅ Plan change webhook sent successfully!`);
    console.log(`📝 Check backend logs for: 🔄 Plan change detected\n`);
  } catch (error) {
    console.error(`❌ Failed to send plan change webhook:`, error.message);
    process.exit(1);
  }
}

main();

