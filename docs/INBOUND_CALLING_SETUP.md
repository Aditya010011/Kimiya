# Inbound Calling Setup Guide

## Overview

This guide covers the setup and usage of the Kimiya Voice AI inbound calling functionality. The system uses a TwiML-based approach (separate from the existing ConversationRelay system) and includes web-based testing capabilities.

## Architecture

### Components

1. **Backend Services**
   - `InboundCallService.js` - Call lifecycle management and analytics
   - `InboundWorkflowProcessor.js` - Workflow processing and node execution
   - `inbound-twiml.js` - TwiML generation and call handling
   - `twilio-voice-token.js` - Token generation for web calling

2. **Frontend Components**
   - `InboundCallTester.tsx` - Main testing interface
   - `twilioVoiceService.ts` - Twilio Voice SDK integration
   - `InboundCallTesting.tsx` - Page component

3. **Database Tables**
   - `tblInboundCalls` - Main call tracking
   - `tblInboundCallSteps` - Conversation flow tracking
   - `tblInboundCallAnalytics` - Call analysis and metrics
   - `tblWebCallSessions` - Web-based test sessions

## Environment Configuration

### Required Environment Variables

Add these to your `.env.development` file:

```bash
# Twilio Configuration (Required)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Required: For web-based calling functionality
TWILIO_TWIML_APP_SID=AP12715ea88e210a323f0d03ce59f1a233

# Required: API Keys for JWT token generation (CRITICAL for Voice SDK)
TWILIO_API_KEY=SKf27f0795012bd29359abc4c1d215cebb
TWILIO_API_SECRET=wrfd81Bfvpb6zlSmdWxMYTp8MtHvVpNf

# Webhook Base URL (Required for TwiML)
WEBHOOK_BASE_URL=https://your-domain.com

# Database Configuration (Already configured)
DB_SERVER=your_db_server
DB_DATABASE=your_database
DB_USER=your_username
DB_PASSWORD=your_password
```

### Twilio Configuration

1. **Account Setup**
   - Sign up for a Twilio account at https://twilio.com
   - Get your Account SID and Auth Token from the Console

2. **Phone Number**
   - Purchase a Twilio phone number
   - Configure the webhook URL for incoming calls

3. **TwiML Application (Optional)**
   - Create a TwiML Application for web calling
   - Set the Voice URL to your webhook endpoint

## Database Setup

Run the database table creation script:

```bash
cd kimiya-voice-dev/backend
NODE_ENV=development node create-inbound-call-tables.cjs
```

This creates the following tables:
- `tblInboundCalls` - Main call records
- `tblInboundCallSteps` - Step-by-step conversation tracking
- `tblInboundCallAnalytics` - Call analysis and metrics
- `tblWebCallSessions` - Web-based test call sessions

## Installation

1. **Install Dependencies**
   ```bash
   cd kimiya-voice-dev
   npm install @twilio/voice-sdk@^2.11.0
   ```

2. **Restart Backend**
   ```bash
   pm2 restart kimiya-voice-backend-dev
   ```

3. **Verify Installation**
   ```bash
   curl -X GET http://localhost:3010/api/inbound/health
   ```

## Usage

### Web-Based Testing

1. **Access the Testing Interface**
   - Navigate to `/inbound-testing` in your application
   - Login with your credentials

2. **Initialize the Voice SDK**
   - Enter an optional identity or leave blank for auto-generation
   - Click "Initialize Voice SDK"
   - Wait for the "READY" status

3. **Select Test Scenario**
   - Choose from predefined scenarios:
     - General Test
     - Customer Support
     - Sales Inquiry
     - Technical Support

4. **Make Test Call**
   - Click "Start Test Call"
   - The system will simulate an inbound call
   - Speak or use DTMF tones to interact

5. **Call Controls**
   - Mute/Unmute microphone
   - Send DTMF tones using the keypad
   - Monitor audio levels
   - End call when finished

### API Endpoints

#### TwiML Endpoints
- `POST /api/inbound/call` - Initial call webhook
- `POST /api/inbound/input` - User input processing
- `POST /api/inbound/status` - Call status updates

#### Web Calling Endpoints
- `POST /api/inbound/token` - Generate access token
- `POST /api/inbound/web-call` - Handle web client calls
- `POST /api/inbound/web-session` - Create test session

#### Analytics Endpoints
- `GET /api/inbound/active-calls` - List active calls
- `GET /api/inbound/stats` - Call statistics
- `GET /api/inbound/history` - Call history
- `GET /api/inbound/analytics/:callSid` - Specific call analytics

#### Health Check
- `GET /api/inbound/health` - Service health status

## Workflow Integration

### Workflow Processing

The system integrates with existing workflows through the `InboundWorkflowProcessor`:

1. **Node Types Supported**
   - `start` - Initial welcome message
   - `ai-response` - AI-powered responses
   - `condition` - Conditional branching
   - `gather` - User input collection
   - `transfer` - Call transfer
   - `end` - Call termination

2. **Workflow Loading**
   - Workflows are loaded from the database
   - Cached for performance
   - Support for dynamic configuration

3. **Node Processing**
   - Each node type has a dedicated processor
   - Context is maintained throughout the call
   - Supports complex conversation flows

### Creating Custom Workflows

1. **Use the Visual Builder**
   - Create workflows using the existing visual builder
   - Configure node properties and connections
   - Save to database

2. **Test with Inbound Calls**
   - Select your workflow in the test interface
   - Make test calls to verify behavior
   - Monitor analytics and logs

## Troubleshooting

### Common Issues

1. **"Device not initialized" Error**
   - Check Twilio credentials in environment variables
   - Verify network connectivity
   - Check browser console for detailed errors

2. **"Failed to get access token" Error**
   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
   - Check backend server is running
   - Verify API endpoint accessibility

3. **No Audio During Calls**
   - Check browser microphone permissions
   - Verify audio device settings
   - Test with different browsers

4. **TwiML Webhook Errors**
   - Verify WEBHOOK_BASE_URL is accessible from internet
   - Check Twilio webhook configuration
   - Review server logs for errors

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
DEBUG=twilio*
```

### Log Monitoring

Monitor real-time logs in the testing interface or check server logs:
```bash
pm2 logs kimiya-voice-backend-dev
```

## Security Considerations

1. **Token Security**
   - Access tokens expire automatically
   - Tokens are scoped to specific capabilities
   - Never expose auth tokens to frontend

2. **Webhook Security**
   - Validate Twilio webhook signatures
   - Use HTTPS for all webhook URLs
   - Implement rate limiting

3. **Database Security**
   - Use parameterized queries (already implemented)
   - Encrypt sensitive call data
   - Regular security audits

## Performance Optimization

1. **Workflow Caching**
   - Workflows are cached in memory
   - Clear cache when workflows are updated
   - Monitor cache hit rates

2. **Database Optimization**
   - Indexes on frequently queried columns
   - Regular cleanup of old call records
   - Connection pooling

3. **Audio Quality**
   - Use enhanced speech recognition
   - Optimize audio codecs
   - Monitor latency metrics

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs and browser console
3. Test with different scenarios and configurations
4. Contact the development team with specific error messages and steps to reproduce
