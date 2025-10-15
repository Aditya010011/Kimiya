/**
 * Create Twilio API Keys for JWT Token Generation
 * 
 * This script creates API Keys required for proper JWT token signing
 * for the Twilio Voice SDK.
 */

const path = require('path');

// Load environment variables
const envFile = path.join(__dirname, '.env.development');
require('dotenv').config({ path: envFile });

const twilio = require('twilio');

async function createApiKeys() {
  try {
    console.log('🔑 Creating Twilio API Keys for JWT token generation...');
    
    // Verify credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    
    console.log('✅ Twilio credentials found');
    console.log('📞 Account SID:', accountSid.substring(0, 8) + '...');
    
    // Initialize Twilio client
    const client = twilio(accountSid, authToken);
    
    // Create API Key
    console.log('🔧 Creating new API Key...');
    const apiKey = await client.newKeys.create({
      friendlyName: 'Kimiya Voice AI - Inbound Calling'
    });
    
    console.log('✅ API Key created successfully!');
    console.log('');
    console.log('🔐 API Key Details:');
    console.log('   SID:', apiKey.sid);
    console.log('   Secret:', apiKey.secret);
    console.log('   Friendly Name:', apiKey.friendlyName);
    console.log('');
    
    console.log('📝 Add these to your .env.development file:');
    console.log('');
    console.log('# Twilio API Keys (for JWT token generation)');
    console.log(`TWILIO_API_KEY=${apiKey.sid}`);
    console.log(`TWILIO_API_SECRET=${apiKey.secret}`);
    console.log('');
    
    console.log('⚠️  IMPORTANT: Save the API Secret now - it will not be shown again!');
    
    return {
      apiKeySid: apiKey.sid,
      apiSecret: apiKey.secret
    };
    
  } catch (error) {
    console.error('❌ Failed to create API Keys:', error.message);
    
    if (error.code === 20003) {
      console.error('💡 This error usually means invalid credentials. Please check:');
      console.error('   - TWILIO_ACCOUNT_SID is correct');
      console.error('   - TWILIO_AUTH_TOKEN is correct');
      console.error('   - Account has sufficient permissions');
    }
    
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createApiKeys()
    .then((keys) => {
      console.log('🎉 API Keys created successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createApiKeys };
