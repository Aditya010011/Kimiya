**Key Features:**
1. **Tool-Based Integration** - Knowledge base accessed via "query" tool
2. **Multiple KB Support** - Can attach multiple KBs to one assistant
4. **Automatic Triggering** - LLM decides when to query KB based on conversation
1. **Agent-Level KB Linking** - Attach KBs directly to agents
2. **Automatic Context Injection** - No prompt changes needed
3. **Node-Level KB** - Can specify KB per conversation node
4. **Configurable Retrieval** - Adjust chunk count (1-10) and similarity threshold (0-1)
5. **Auto-Refresh** - URLs auto-refresh every 24 hours

````text path=mode=EXCERPT
During the call, when the agent is about to respond, it will use 
the transcript so far to find the most relevant chunks from the 
knowledge base, and feed them to the LLM as context under the 
header "## Related Knowledge Base Contexts"
````

**Integration Pattern:**
- Automatic retrieval before every LLM response
- Context appended to prompt automatically
- No tool calling required

---


### **Architecture: Hybrid Approach**

```
┌─────────────────────────────────────────────────────────────┐
│                    Voice Call Incoming                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Conversation Flow Processor                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Current Node: AI Conversation Node                   │  │
│  │  - Has linked Knowledge Bases: [KB1, KB2]            │  │
│  │  - Retrieval Config: topK=3, threshold=0.6           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Knowledge Base Retrieval Service                   │
│  1. Extract user query from conversation                     │
│  2. Query linked KBs (parallel search)                       │
│  3. Merge and rank results                                   │
│  4. Return top N chunks                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              LLM Response Generation                         │
│  System Prompt + KB Context + Conversation History          │
│  → Generate Response                                         │
└─────────────────────────────────────────────────────────────┘
```



  ### 1. Backend Services

#### **ConversationKBService** (`backend/services/ConversationKBService.js`)
New service for querying knowledge bases during conversations.

**Key Methods**:
- `queryMultipleKBs(query, kbIds, userId, config)` - Query multiple KBs in parallel
- `queryKB(kbId, query, userId, topK, enableQueryRewriting)` - Query single KB
- `formatKBContext(results, options)` - Format results for LLM prompt
- `getConversationContext(messages, kbIds, userId, config)` - Main method for chat integration

**Features**:
- Parallel KB queries for performance
- Automatic result merging and ranking
- Similarity threshold filtering
- Query rewriting for better semantic matching
- Retell AI-style context formatting: "## Related Knowledge Base Contexts"

**New Features**:
- Knowledge base multi-select dropdown
- Retrieval configuration panel
- Visual badges showing selected KBs
- Collapsible settings for topK and similarity threshold

**UI Components Added**:
- Popover with checkbox list for KB selection
- Badge display for selected KBs with remove option
- Configuration panel with:
  - Chunks to Retrieve (1-10)
  - Similarity Threshold (0-1)


  ## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. User sends message in Chat Playground                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. PlaygroundModal extracts KB config from current node    │
│     - knowledgeBases: ["kb_123", "kb_456"]                  │
│     - kbRetrievalConfig: { topK: 3, threshold: 0.6 }        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. POST /api/chat with KB data                             │
│     {                                                        │
│       messages: [...],                                       │
│       knowledgeBases: ["kb_123", "kb_456"],                 │
│       kbRetrievalConfig: {...}                              │
│     }                                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Chat endpoint calls ConversationKBService                │
│     - Extracts user query from messages                      │
│     - Queries all KBs in parallel                           │
│     - Merges and ranks results                              │
│     - Formats context for LLM                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. KB Context injected into system prompt                  │
│                                                              │
│     System Prompt + KB Context:                             │
│     "You are a helpful assistant...                         │
│                                                              │
│     ## Related Knowledge Base Contexts                      │
│                                                              │
│     [1] Product X costs $99 and includes...                 │
│         (Source: Product KB, Relevance: 92%)                │
│                                                              │
│     [2] Shipping takes 3-5 business days...                 │
│         (Source: FAQ KB, Relevance: 87%)                    │
│     "                                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Azure OpenAI generates response with KB context         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Response returned with KB metadata                      │
│     {                                                        │
│       response: "Product X costs $99...",                   │
│       knowledgeBaseInfo: {                                  │
│         chunksUsed: 2,                                      │
│         knowledgeBases: ["Product KB", "FAQ KB"],          │
│         averageRelevance: "89%"                            │
│       }                                                     │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

**Configuration Recommendations**
Use Case	topK	Similarity Threshold
- General Q&A	3-5	0.6-0.7
- Precise Info	1-3	0.7-0.9
- Broad Context	5-10	0.5-0.6