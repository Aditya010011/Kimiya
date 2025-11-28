# Workflow Builder: Agent Creation and Execution Guide

## Overview
This document explains how the workflow builder creates an AI agent using nodes, edges, and conditions, and how it executes in both the Chat Playground and Outbound Calling scenarios.

---

## 1. WORKFLOW BUILDER - Agent Creation

### 1.1 Node Types
The workflow builder provides several node types that define the agent's behavior:

#### **Start Node** (`startNode`)
- **Purpose**: Entry point of the workflow
- **Configuration**:
  - `firstMessage`: Initial greeting when call/chat starts
  - `globalPrompt`: System-wide instructions for the AI agent
- **File**: `src/components/FlowBuilder/components/nodes/StartCallComponent.tsx`

#### **AI/Conversation Node** (`conversationNode`)
- **Purpose**: AI-powered conversational interactions
- **Configuration**:
  - `prompt`: Node-specific instructions for the AI
  - `model`: AI model to use (e.g., 'gpt-4o')
  - `knowledgeBases`: Array of KB IDs for RAG
  - `kbRetrievalConfig`: Settings for KB retrieval (topK, threshold)
- **File**: `src/components/FlowBuilder/components/nodes/AINodeComponent.tsx`

#### **API Request Node** (`apiRequest`)
- **Purpose**: Make HTTP requests to external APIs
- **Configuration**:
  - `url`: API endpoint
  - `method`: HTTP method (GET, POST, PUT, DELETE)
  - `headers`: Request headers (JSON)
  - `body`: Request body (JSON with variable interpolation)
- **File**: `src/components/FlowBuilder/components/nodes/PlayAudioComponent.tsx`

#### **Transfer Call Node** (`transferCall`)
- **Purpose**: Transfer the call to another number/agent
- **Configuration**:
  - `destination`: Phone number or agent identifier
  - `transferMessage`: Message before transfer
- **File**: `src/components/FlowBuilder/components/nodes/TransferCallComponent.tsx`

#### **End Call Node** (`endCall`)
- **Purpose**: Terminate the conversation
- **Configuration**:
  - `farewell`: Goodbye message
  - `reason`: End reason (completed, transferred, error)
- **File**: `src/components/FlowBuilder/components/nodes/EndCallComponent.tsx`

### 1.2 Edges and Conditions
Edges connect nodes and define the conversation flow. Each edge can have conditions that determine when it should be followed.

#### **Condition Types** (defined in `src/types/flowTypes.ts`):

1. **AI Condition** (`ConditionType.AI`)
   - Natural language description of when to follow this path
   - Example: "User wants to speak to a human agent"
   - Evaluated by AI during runtime

2. **Logical Condition** (`ConditionType.LOGICAL`)
   - Variable-based comparisons using operators
   - Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `not_contains`
   - Example: `user_age > 18`

3. **Combined Condition** (`ConditionType.COMBINED`)
   - Mix of AI and logical conditions
   - Allows complex decision trees

4. **Default Path** (`isDefault: true`)
   - Fallback path when no other conditions match

### 1.3 Variables
Variables allow data to flow between nodes:

- **Extracted Variables**: Defined in `VariableExtractor.tsx`
  - `name`: Variable identifier
  - `type`: STRING, NUMBER, INTEGER, BOOLEAN
  - `description`: What the variable captures
  - `nodeId`: Which node extracts this variable
  - `enumValues`: Predefined values for string types

- **Variable Usage**:
  - In edge conditions for routing decisions
  - In API request bodies using liquid syntax: `{{variable_name}}`
  - In prompts for context

### 1.4 Workflow Storage
Workflows are stored in the `flowStore` (Zustand state management):

**File**: `src/stores/flowStore.ts`

```typescript
interface FlowState {
  nodes: Node[]                    // Array of workflow nodes
  edges: ConditionalEdge[]         // Array of edges with conditions
  workflowContext: {
    variables: Map<string, ExtractedVariable>
    executionPath: string[]
  }
  workflowConfig: WorkflowConfig   // Metadata (id, name, description)
}
```

- **Auto-save**: Changes are automatically saved to localStorage
- **Database**: Workflows can be saved to PostgreSQL via API
- **Export/Import**: Workflows can be exported as JSON

---

## 2. CHAT PLAYGROUND - Execution Flow

### 2.1 Initialization
**File**: `src/components/FlowBuilder/components/PlaygroundModal.tsx`

1. User clicks "Test Workflow" button
2. `handleStartSimulation()` is called
3. System finds the start node: `nodes.find(n => n.type === 'startNode')`
4. Sets `currentNodeId` to start node's ID
5. Creates analytics session (if enabled)

### 2.2 Node Execution Loop

```
Current Node → Execute Logic → Get AI Response → Evaluate Conditions → Move to Next Node
```

#### **Step 1: Execute Node Logic**
Function: `simulateWorkflowStep(userMessage)`

- Gets current node: `nodes.find(node => node.id === currentNodeId)`
- Checks node type and executes accordingly

#### **Step 2: For AI/Conversation Nodes**
Function: `callBackendChatAPI(messages)`

**Request to Backend** (`/api/chat` or `/api/chat-with-analytics`):
```json
{
  "messages": [...conversationHistory],
  "workflowId": "workflow-123",
  "currentNodeId": "node-456",
  "globalPrompt": "You are a helpful assistant...",
  "knowledgeBases": ["kb1", "kb2"],
  "kbRetrievalConfig": { "topK": 3, "similarityThreshold": 0.6 }
}
```

**Backend Processing** (`backend/routes/chat.js` or `chat-with-analytics.js`):
1. Retrieves workflow data from `global.workflowData[workflowId]`
2. Gets current node configuration
3. Builds system prompt:
   ```
   globalPrompt + "\n\nCurrent node context: " + node.data.prompt
   ```
4. If knowledge bases configured:
   - Queries Qdrant vector DB for relevant context
   - Appends KB context to system prompt
5. Calls Azure OpenAI with combined prompt
6. Returns AI response with token usage

#### **Step 3: Determine Next Node**
Function: `shouldMoveToNextNode()` and `moveToNextNode()`

**Condition Evaluation**:
1. Get outgoing edges: `edges.filter(e => e.source === currentNodeId)`
2. If single edge → follow it
3. If multiple edges → evaluate conditions:
   - **AI Conditions**: Ask AI if condition is met
   - **Logical Conditions**: Compare variables
   - **Keyword Matching**: Check for specific words
4. Select first matching edge or default edge
5. Update `currentNodeId` to target node
6. Reset conversation turns counter

---

## 3. OUTBOUND CALLING - Execution Flow

### 3.1 Call Initiation
**File**: `src/services/twilioService.ts`

1. User enters phone number and clicks "Make Call"
2. `TwilioService.makeOptimizedCall()` is called
3. Sends request to backend: `/api/make-call-optimized`

**Request Payload**:
```json
{
  "to": "+1234567890",
  "from": "+0987654321",
  "workflowId": "workflow-123",
  "nodes": [...],
  "edges": [...],
  "globalPrompt": "...",
  "config": {...},
  "twilioAccountSid": "AC...",
  "twilioAuthToken": "..."
}
```

### 3.2 Backend Call Setup
**File**: `backend/routes/make-call-optimized.js`

1. Validates phone number and credentials
2. Stores workflow in `global.workflowData[workflowId]`
3. Initializes `PerformanceOrchestrator` for optimization
4. Generates unique `callTrackingId`
5. Calls Twilio API to initiate call
6. Provides TwiML endpoint: `/api/twiml-optimized?id={workflowId}&trackingId={callTrackingId}`

### 3.3 TwiML Generation
**File**: `backend/routes/twiml-optimized.js`

Generates TwiML with ConversationRelay:
```xml
<Response>
  <Connect>
    <ConversationRelay
      url="wss://your-domain.com/ws"
      welcomeGreeting="Hello! How can I help you?"
      ttsProvider="Google"
      voice="en-US-Journey-O"
      language="en-US"
    />
  </Connect>
</Response>
```

- **welcomeGreeting**: Taken from start node's `firstMessage`
- **WebSocket URL**: For bidirectional audio streaming
- **TTS Provider**: Google or ElevenLabs

### 3.4 Conversation Processing
**File**: `backend/services/conversationRelay.js`

#### **Initialization**:
```javascript
startConversation(callSid, workflowData) {
  // Find start node
  const startNode = findStartNode(workflowData.nodes)
  
  // Store call data
  activeCalls.set(callSid, {
    workflowData,
    conversationHistory: [],
    currentNode: startNode.id,
    tokenUsage: {...}
  })
}
```

#### **Audio Processing Loop**:
```
User Speaks → Audio Stream → Speech-to-Text → processInput() → 
Execute Node → Generate Response → Text-to-Speech → Audio Stream → User Hears
```

#### **Node Execution**:
Function: `executeNode(node, input, callData)`

```javascript
switch (node.type) {
  case 'startnode':
  case 'start':
    return { response: node.data.firstMessage, action: 'speak' }
  
  case 'conversationnode':
  case 'ai':
    // Build prompt from global + node-specific
    const systemPrompt = globalPrompt + "\n\n" + node.data.prompt
    // Call Azure OpenAI
    const aiResponse = await generateAIResponse(systemPrompt, input)
    return { response: aiResponse, action: 'speak' }
  
  case 'apirequest':
    // Execute HTTP request
    const result = await executeAPIRequest(node.data)
    return { response: result, action: 'speak' }
  
  case 'transfercall':
    return { response: node.data.transferMessage, action: 'transfer', destination: node.data.destination }
  
  case 'endcall':
    return { response: node.data.farewell, action: 'end' }
}
```

#### **Edge Condition Evaluation**:
Function: `determineNextNode(workflowData, currentNode, input, nodeResult)`

```javascript
// Get outgoing edges
const edges = workflowData.edges.filter(e => e.source === currentNode.id)

if (edges.length === 1) {
  return findNodeById(edges[0].target)
}

// Evaluate conditions
for (const edge of edges) {
  if (evaluateEdgeCondition(edge, input, nodeResult)) {
    return findNodeById(edge.target)
  }
}
```

**Condition Evaluation**:
```javascript
evaluateEdgeCondition(edge, input, nodeResult) {
  if (!edge.condition) return true  // No condition = always follow
  
  // Keyword matching
  if (edge.condition.keywords) {
    return keywords.some(kw => input.toLowerCase().includes(kw))
  }
  
  // DTMF digit matching
  if (edge.condition.digit && input.startsWith('DTMF:')) {
    return input.substring(5) === edge.condition.digit
  }
  
  // AI condition evaluation
  if (edge.condition.aiCondition) {
    return await evaluateAICondition(edge.condition.aiCondition, input)
  }
  
  // Logical condition evaluation
  if (edge.condition.logicalConditions) {
    return evaluateLogicalConditions(edge.condition.logicalConditions, variables)
  }
}
```

---

## 4. Key Components and Files

### Frontend
- **Workflow Builder**: `src/components/FlowBuilder/NewFlowCanvas.tsx`
- **Node Components**: `src/components/FlowBuilder/components/nodes/`
- **Edge Component**: `src/components/FlowBuilder/components/ConditionalEdge.tsx`
- **Config Panel**: `src/components/FlowBuilder/ConfigPanel.tsx`
- **Playground**: `src/components/FlowBuilder/components/PlaygroundModal.tsx`
- **State Management**: `src/stores/flowStore.ts`
- **Types**: `src/types/flowTypes.ts`, `src/types/componentTypes.ts`

### Backend
- **Call Initiation**: `backend/routes/make-call-optimized.js`
- **TwiML Generation**: `backend/routes/twiml-optimized.js`
- **Chat API**: `backend/routes/chat.js`, `backend/routes/chat-with-analytics.js`
- **Conversation Engine**: `backend/services/conversationRelay.js`
- **Workflow Processor**: `backend/services/InboundWorkflowProcessor.js`
- **Performance**: `backend/services/performanceOrchestrator.js`

---

## 5. Data Flow Summary

### Chat Playground:
```
User Input → Frontend (PlaygroundModal) → Backend (/api/chat) → 
Azure OpenAI → Response → Frontend → Evaluate Conditions → Next Node
```

### Outbound Calling:
```
Make Call → Backend (/api/make-call-optimized) → Twilio API → 
TwiML (/api/twiml-optimized) → WebSocket Connection → 
ConversationRelay → Node Execution → Azure OpenAI → 
TTS → Audio → User → STT → Next Input
```

---

## 6. Advanced Features

### 6.1 Knowledge Base Integration (RAG)
- Configured per AI node
- Queries Qdrant vector database
- Retrieves top-K relevant documents
- Appends context to system prompt

### 6.2 Performance Optimization
- `PerformanceOrchestrator`: Manages latency targets
- `PredictiveCache`: Caches common responses
- `StreamingAudioProcessor`: Real-time audio processing
- Target latency: 150-250ms

### 6.3 Analytics
- Session tracking with `chatAnalyticsService`
- Token usage monitoring
- Message history storage
- Credit deduction per interaction

### 6.4 Variable Interpolation
- Liquid syntax in API bodies: `{{variable_name}}`
- Variables extracted from conversation
- Used in conditions and subsequent nodes

---

## 7. Example Workflow Execution

**Scenario**: Restaurant reservation system

1. **Start Node**: "Hello! Welcome to Bistro Restaurant. How can I help you?"
2. **AI Node 1**: Collects reservation details (date, time, party size)
   - Extracts variables: `reservation_date`, `party_size`
3. **Condition Edge**: If `party_size > 6` → Transfer to manager
4. **API Node**: Checks availability via restaurant API
5. **AI Node 2**: Confirms reservation or offers alternatives
6. **End Node**: "Your reservation is confirmed. See you soon!"

**Edge Conditions**:
- Edge 1→2: Default (always follow)
- Edge 2→3: Logical condition `party_size > 6`
- Edge 2→4: Logical condition `party_size <= 6`
- Edge 4→5: AI condition "Availability confirmed"
- Edge 4→5: AI condition "No availability, offer alternatives"
- Edge 5→6: Default

---

## Conclusion

The workflow builder creates a visual, node-based representation of an AI agent's conversation flow. During execution (chat or call), the system:
1. Starts at the designated start node
2. Executes node-specific logic (AI response, API call, etc.)
3. Evaluates edge conditions to determine the next node
4. Continues until reaching an end node or termination condition

This architecture allows for complex, branching conversations with AI-powered decision-making, external API integrations, and dynamic routing based on user input and extracted variables.

