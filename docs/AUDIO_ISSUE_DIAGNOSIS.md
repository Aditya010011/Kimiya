# Audio Issue Diagnosis: AI Not Hearing Speech Input

## 🔍 **Problem Summary**
The AI system is not processing or responding to user speech input during web-based calls, despite successful call connection and audio output working correctly.

## 🎯 **Root Cause: Architecture Mismatch**

### **The Issue**
Your web-based call uses **two incompatible architectures**:

1. **Frontend (Web Call)**: Twilio Voice SDK → Direct WebRTC → TwiML App
2. **Backend (Speech Processing)**: Expects TwiML webhooks → `handleUserInput` → Azure OpenAI

### **What's Happening**
```
Web Call Flow (Current):
Browser → Twilio Voice SDK → WebRTC → TwiML App (AP12715ea88e210a323f0d03ce59f1a233)
                                           ↓
                                    handleOutgoingCall() 
                                           ↓
                                    Redirects to /api/inbound/call
                                           ↓
                                    Generates TwiML with <Gather>
                                           ↓
                                    ❌ BREAKS HERE - No webhook calls made
```

**Expected Flow for Speech Processing:**
```
TwiML <Gather> → User speaks → Twilio STT → Webhook to /api/inbound/input → AI Processing
```

## 🔧 **Technical Details**

### **1. TwiML App Configuration Issue**
Your TwiML App (`AP12715ea88e210a323f0d03ce59f1a233`) is configured to:
- **Voice URL**: Points to `handleOutgoingCall` 
- **Voice Method**: POST
- **Status Callback**: Not configured for speech webhooks

### **2. Missing Webhook Chain**
The `<Gather>` elements in your TwiML are correctly configured:
```xml
<Gather
    input="speech dtmf"
    action="https://dev-ai-phone-call.kimiyi.ai/api/inbound/input"
    method="POST"
    speechTimeout="3"
    timeout="10"
    language="en-US"
    enhanced="true">
```

**But**: Twilio never calls these webhooks because the web call doesn't follow the traditional phone call flow.

### **3. Architecture Comparison**

#### **Outbound Calls (Working)**
- Use ConversationRelay with WebSocket
- Real-time audio streaming
- Direct speech processing

#### **Inbound Calls (Your Issue)**
- Use TwiML with HTTP webhooks
- Expect Twilio to make HTTP requests
- Speech processed via `handleUserInput`

#### **Web Calls (Current Problem)**
- Start as outbound calls
- Redirect to inbound system
- **Missing**: Webhook execution for speech

## 🚨 **Evidence from Logs**

### **From Your Call (CA40018d4db9304065001ba71a56d4421c)**
- ✅ Call connected successfully
- ✅ WebRTC media established
- ✅ Audio output working (you can hear the AI)
- ❌ No `🎤 User input received:` logs in backend
- ❌ No webhook calls to `/api/inbound/input`

### **Expected vs Actual**
**Expected Backend Logs (Missing):**
```
🎤 User input received: { callSid: 'CA40018...', userInput: 'Hello', confidence: 0.95 }
✅ User input processed in 250.00ms
```

**Actual Backend Logs:**
```
📞 Outgoing call from web client
✅ Redirecting to inbound handler
[No further speech processing logs]
```

## 💡 **Solutions**

### **Option 1: Fix Web Call Architecture (Recommended)**
Modify the web call system to use ConversationRelay instead of TwiML:

```javascript
// In handleOutgoingCall, instead of redirecting to inbound:
const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay
            url="wss://dev-ai-phone-call.kimiyi.ai/api/conversationrelay-ws?workflowId=${workflowId}"
            welcomeGreeting="Hello! I'm your AI assistant. How can I help you today?"
            ttsProvider="Google"
            voice="en-US-Journey-O"
            language="en-US"
        />
    </Connect>
</Response>`;
```

### **Option 2: Implement Media Streams (Complex)**
Add Media Streams support to capture audio from web calls:

```javascript
// Add to TwiML response
<Connect>
    <Stream url="wss://dev-ai-phone-call.kimiyi.ai/api/media-stream" />
</Connect>
```

### **Option 3: Use Traditional Phone Calls**
Test with actual phone calls instead of web calls to verify the inbound system works.

## 🔧 **Immediate Fix Implementation**

The quickest fix is to modify `handleOutgoingCall` to use ConversationRelay:

1. **Update TwiML Generation**: Use ConversationRelay instead of redirect
2. **Enable WebSocket Handler**: Ensure ConversationRelay WebSocket is active
3. **Configure Workflow**: Map web call workflows to ConversationRelay

## 🧪 **Testing Strategy**

### **1. Verify Current System**
```bash
# Check if backend receives webhook calls
tail -f /var/www/kimiya-voice-dev/backend/logs/dev-out-0.log | grep "User input"
```

### **2. Test with Phone Call**
Make an actual phone call to `+17077433838` to verify inbound system works.

### **3. Test ConversationRelay**
Use the working outbound system to verify speech processing works.

## 📊 **System Status**

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Server | ✅ Running | PID 3294734 |
| Environment Config | ✅ Loaded | All credentials present |
| TwiML App | ✅ Configured | AP12715ea88e210a323f0d03ce59f1a233 |
| Webhook URLs | ✅ Valid | https://dev-ai-phone-call.kimiyi.ai |
| Speech Processing | ❌ Not Triggered | No webhook calls |
| Azure OpenAI | ✅ Ready | Endpoint configured |

## 🎯 **Next Steps**

1. **Implement ConversationRelay fix** (recommended)
2. **Test with actual phone calls** to verify inbound system
3. **Add logging** to track webhook calls
4. **Monitor audio flow** end-to-end

The issue is architectural, not a bug - the web call system needs to be aligned with the speech processing system.
