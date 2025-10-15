# Azure OpenAI Integration for Inbound Calls

## Overview

This document describes the Azure OpenAI integration implemented for the Kimiya Voice AI inbound call system. The integration provides intelligent conversational AI capabilities while maintaining the existing TwiML-based architecture.

## Architecture

### Components Updated

1. **InboundCallService.js** - Enhanced with conversation history management
2. **InboundWorkflowProcessor.js** - Integrated with Azure OpenAI API
3. **inbound-twiml.js** - Updated to use AI responses and manage conversation flow

### Integration Flow

```
Inbound Call → TwiML Handler → Workflow Processor → Azure OpenAI → Response → TwiML
     ↓              ↓                ↓               ↓           ↓        ↓
Database      Conversation     AI Context      API Call    Response   Voice
Tracking       History        Building                    Processing  Output
```

## Key Features

### 1. Conversation History Management

- **Storage**: Conversation history stored in memory for active calls
- **Context**: Full conversation context passed to Azure OpenAI
- **Limit**: Last 20 messages kept to manage memory and API costs
- **Persistence**: Conversation steps logged to database for analytics

### 2. Workflow-Driven AI Responses

- **Global Prompts**: Uses workflow `globalPrompt` as system message
- **Node Context**: Incorporates node-specific prompts and instructions
- **Dynamic Context**: AI responses adapt based on current workflow node

### 3. Error Handling & Fallbacks

- **Graceful Degradation**: Falls back to simple responses if Azure OpenAI fails
- **Error Logging**: All errors logged for debugging and analytics
- **Intelligent Fallbacks**: Context-aware error responses

## Implementation Details

### Environment Configuration

Required environment variables (already configured in `.env.development`):

```bash
AZURE_OPENAI_ENDPOINT=https://innochattemp.openai.azure.com/openai/deployments/gpt4omini/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=f6d564a83af3498c9beb46d7d3e3da96
```

### API Configuration

- **Model**: GPT-4o Mini (via Azure OpenAI)
- **Max Tokens**: 200 (optimized for voice responses)
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Response Length**: Optimized for voice calls (<100 words)

### Conversation Flow

1. **Call Initiation**:
   - System message added to conversation history
   - Workflow loaded and start node identified
   - Initial AI response generated with workflow context

2. **User Input Processing**:
   - User speech converted to text by Twilio
   - User message added to conversation history
   - Full conversation context sent to Azure OpenAI
   - AI response generated with workflow and node context
   - Response added to conversation history
   - TwiML generated for voice output

3. **Context Management**:
   - System prompt built from workflow global prompt
   - Node-specific context added from current workflow node
   - Conversation history (last 10 messages) included for context
   - Current node ID tracked for workflow progression

## Database Integration

### Enhanced Call Tracking

```sql
-- Conversation steps now include AI responses
INSERT INTO tblInboundCallSteps (
    call_id, call_sid, step_number, step_type, step_action,
    user_input, ai_response, node_id, processing_time, confidence_score
)
```

### Analytics Enhancement

- AI response quality tracking
- Processing time monitoring
- Error rate analysis
- Conversation completion metrics

## Testing

### Automated Testing

Run the test script to verify integration:

```bash
cd kimiya-voice-dev/backend
node test-inbound-ai.js
```

### Test Coverage

- Azure OpenAI API connectivity
- Conversation history management
- Workflow processing with AI
- Error handling and fallbacks
- Database integration

## Performance Considerations

### Optimization Strategies

1. **Response Length**: Limited to 200 tokens for faster processing
2. **Context Management**: Only last 10 messages sent to reduce API costs
3. **Caching**: Workflow data cached to reduce database queries
4. **Error Handling**: Fast fallbacks to prevent call delays

### Expected Performance

- **AI Response Time**: 1-3 seconds (depending on Azure OpenAI latency)
- **Total Processing**: 2-4 seconds per user input
- **Memory Usage**: ~1KB per active call for conversation history

## Monitoring & Analytics

### Key Metrics

- AI response generation time
- API success/failure rates
- Conversation completion rates
- User satisfaction indicators

### Logging

All AI interactions logged with:
- Request/response content
- Processing times
- Error details
- Workflow context

## Troubleshooting

### Common Issues

1. **Azure OpenAI API Errors**:
   - Check API key and endpoint configuration
   - Verify network connectivity
   - Monitor API rate limits

2. **Slow Response Times**:
   - Check Azure OpenAI service status
   - Optimize prompt length
   - Review conversation history size

3. **Context Issues**:
   - Verify workflow configuration
   - Check node-specific prompts
   - Review conversation history management

### Debug Mode

Enable detailed logging by setting:
```bash
DEBUG=inbound:*
NODE_ENV=development
```

## Future Enhancements

### Planned Improvements

1. **Advanced Context**: Integration with customer data and CRM systems
2. **Multi-language**: Support for multiple languages in conversations
3. **Sentiment Analysis**: Real-time sentiment tracking during calls
4. **Custom Models**: Fine-tuned models for specific use cases

### Scalability Considerations

- Redis integration for conversation history persistence
- Load balancing for high-volume scenarios
- API rate limiting and queuing
- Performance monitoring and alerting

## Security

### Data Protection

- Conversation data encrypted in transit and at rest
- API keys secured in environment variables
- PII handling compliance (GDPR, CCPA)
- Call recording consent management

### Access Control

- API endpoint authentication
- Role-based access to conversation data
- Audit logging for all AI interactions
- Secure webhook validation

## Conclusion

The Azure OpenAI integration successfully transforms the inbound call system from simple keyword-based responses to intelligent, context-aware conversations while maintaining the reliable TwiML architecture. The implementation provides a solid foundation for advanced conversational AI capabilities in voice applications.
