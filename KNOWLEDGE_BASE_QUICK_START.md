# 🚀 Knowledge Base - Quick Start Guide

## ✅ Frontend Status: COMPLETE & READY

The Knowledge Base UI is **100% complete** and ready to use. This guide will help you understand what's been built and how to proceed with backend implementation.

---

## 📁 Files Created

### **Components** (6 files)
```
src/components/knowledge-base/
├── CreateKnowledgeBaseModal.tsx      ✅ Create new KB modal
├── KnowledgeBaseDetailModal.tsx      ✅ View/manage KB modal
├── DocumentUploadArea.tsx            ✅ Drag-drop upload component
├── SearchKnowledgeBase.tsx           ✅ Search & test interface
└── index.ts                          ✅ Component exports
```

### **Pages** (1 file)
```
src/pages/
└── KnowledgeBase.tsx                 ✅ Main KB page
```

### **Services** (1 file)
```
src/services/
└── knowledgeBaseService.ts           ✅ API client service
```

### **Updated Files** (2 files)
```
src/
├── App.tsx                           ✅ Added /knowledge-base route
└── components/layout/
    └── DashboardHeader.tsx           ✅ Added KB menu item
```

---

## 🎯 How to Access

1. **Start the development server:**
   ```bash
   cd /var/www/kimiya-voice-dev
   npm run dev
   ```

2. **Navigate to Knowledge Base:**
   - Click on your user avatar (top right)
   - Select "Knowledge Base" from dropdown menu
   - Or directly visit: `http://localhost:3000/knowledge-base`

---

## 🎨 UI Features Overview

### **Main Page** (`/knowledge-base`)
- Grid view of all knowledge bases
- Search bar (searches name & description)
- Filter by status (All, Active, Inactive)
- Sort by (Name, Documents, Created Date)
- Create new KB button
- View/Delete actions per KB

### **Create Modal**
- Name field (required)
- Description field (optional)
- Advanced settings (collapsible):
  - Embedding model selection
  - Chunk size (100-2000 tokens)
  - Chunk overlap (0-500 tokens)

### **Detail Modal** (3 tabs)

**Tab 1: Documents**
- List all documents in KB
- Shows: filename, size, chunks, status, date
- Delete document action
- Refresh button

**Tab 2: Upload**
- Drag-and-drop upload area
- Click to browse files
- Accepts: PDF, DOCX, TXT (max 50MB)
- Real-time progress bars
- Upload queue management

**Tab 3: Search & Test**
- **Vector Search Mode:**
  - Returns top 5 relevant chunks
  - Shows relevance scores
  - Copy to clipboard
  
- **RAG Query Mode:**
  - AI-generated response
  - Source citations
  - Copy response

---

## 🔌 Backend Integration Required

The frontend is calling these API endpoints (currently will fail until backend is implemented):

### **Knowledge Base Endpoints**
```
GET    /api/knowledge-base              - List all KBs
POST   /api/knowledge-base              - Create new KB
GET    /api/knowledge-base/:id          - Get single KB
PUT    /api/knowledge-base/:id          - Update KB
DELETE /api/knowledge-base/:id          - Delete KB
GET    /api/knowledge-base/:id/stats    - Get statistics
```

### **Document Endpoints**
```
GET    /api/knowledge-base/:id/documents           - List documents
POST   /api/knowledge-base/:id/upload              - Upload document
DELETE /api/knowledge-base/:id/documents/:docId    - Delete document
```

### **Search Endpoints**
```
POST   /api/knowledge-base/:id/search   - Vector search
POST   /api/knowledge-base/:id/query    - RAG query
```

---

## 📊 Expected API Response Formats

### **List Knowledge Bases**
```json
{
  "knowledgeBases": [
    {
      "id": "kb_123",
      "name": "Product Documentation",
      "description": "All product docs",
      "document_count": 15,
      "total_chunks": 450,
      "embedding_model": "text-embedding-ada-002",
      "chunk_size": 1000,
      "chunk_overlap": 200,
      "is_active": true,
      "created_at": "2025-10-30T10:00:00Z",
      "updated_at": "2025-10-30T10:00:00Z"
    }
  ]
}
```

### **List Documents**
```json
{
  "documents": [
    {
      "id": "doc_456",
      "filename": "user-guide.pdf",
      "file_type": "application/pdf",
      "file_size": 1048576,
      "chunk_count": 25,
      "processing_status": "completed",
      "created_at": "2025-10-30T10:00:00Z",
      "processed_at": "2025-10-30T10:05:00Z"
    }
  ]
}
```

### **Vector Search Results**
```json
{
  "results": [
    {
      "id": "chunk_789",
      "text": "This is the relevant text chunk...",
      "score": 0.92,
      "documentId": "doc_456",
      "chunkIndex": 5,
      "metadata": {}
    }
  ],
  "responseTime": 45
}
```

### **RAG Query Response**
```json
{
  "response": "Based on the documentation, here's how to...",
  "sources": [
    {
      "text": "Source text chunk...",
      "score": 0.92,
      "documentId": "doc_456"
    }
  ]
}
```

---

## 🗄️ Database Schema Needed

### **tblKnowledgeBases**
```sql
CREATE TABLE tblKnowledgeBases (
    id VARCHAR(50) PRIMARY KEY,
    user_id INT NOT NULL,
    organization_id VARCHAR(50),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
    chunk_size INT DEFAULT 1000,
    chunk_overlap INT DEFAULT 200,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES tblUsers(id)
);
```

### **tblDocuments**
```sql
CREATE TABLE tblDocuments (
    id VARCHAR(50) PRIMARY KEY,
    knowledge_base_id VARCHAR(50) NOT NULL,
    filename NVARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    blob_url NVARCHAR(MAX),
    chunk_count INT DEFAULT 0,
    processing_status VARCHAR(20) DEFAULT 'pending',
    error_message NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    processed_at DATETIME2,
    FOREIGN KEY (knowledge_base_id) REFERENCES tblKnowledgeBases(id) ON DELETE CASCADE
);
```

### **tblDocumentChunks**
```sql
CREATE TABLE tblDocumentChunks (
    id VARCHAR(50) PRIMARY KEY,
    document_id VARCHAR(50) NOT NULL,
    chunk_index INT NOT NULL,
    chunk_text NVARCHAR(MAX) NOT NULL,
    vector_id VARCHAR(100),
    token_count INT,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (document_id) REFERENCES tblDocuments(id) ON DELETE CASCADE
);
```

---

## 🐳 Vector Database Setup (Qdrant)

### **Install Qdrant via Docker**
```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### **Install Qdrant Client**
```bash
npm install @qdrant/js-client-rest
```

### **Environment Variables**
Add to `.env`:
```bash
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key-here  # Optional for local
```

---

## 📦 Required npm Packages (Backend)

```bash
npm install @qdrant/js-client-rest pdf-parse mammoth multer
```

- `@qdrant/js-client-rest` - Qdrant vector database client
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction
- `multer` - File upload handling

---

## 🔄 Processing Pipeline

1. **User uploads document** → Frontend sends to `/api/knowledge-base/:id/upload`
2. **Backend receives file** → Save to disk/blob storage
3. **Extract text** → Use pdf-parse or mammoth
4. **Chunk text** → Split into 1000-token chunks with 200 overlap
5. **Generate embeddings** → Call Azure OpenAI embeddings API
6. **Store vectors** → Save to Qdrant collection
7. **Update database** → Mark document as "completed"

---

## 🧪 Testing the UI (Without Backend)

The UI is fully functional for visual testing:
- ✅ All modals open/close
- ✅ Forms validate input
- ✅ Drag-drop area responds to interactions
- ✅ Tabs switch correctly
- ✅ Search/filter/sort work (on mock data)

To test with mock data, temporarily add this to `KnowledgeBase.tsx`:
```typescript
useEffect(() => {
  // Mock data for testing
  setKnowledgeBases([
    {
      id: 'kb_1',
      name: 'Product Documentation',
      description: 'All product documentation',
      document_count: 15,
      total_chunks: 450,
      embedding_model: 'text-embedding-ada-002',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);
}, []);
```

---

## 🎯 Next Steps

1. ✅ **Frontend Complete** - No action needed
2. ⏳ **Create Database Tables** - Run SQL scripts
3. ⏳ **Setup Qdrant** - Docker container
4. ⏳ **Implement Backend APIs** - Express routes
5. ⏳ **Implement Document Processing** - Text extraction + chunking
6. ⏳ **Implement RAG Pipeline** - Embeddings + search + LLM
7. ⏳ **Test End-to-End** - Upload → Process → Search → Query

---

## 📞 Support

If you need help with backend implementation, refer to:
- `KNOWLEDGE_BASE_UI_IMPLEMENTATION.md` - Full documentation
- `src/services/knowledgeBaseService.ts` - API client reference
- Previous research documents on RAG implementation

---

**Status:** Frontend 100% Complete ✅  
**Next Phase:** Backend Implementation  
**Estimated Backend Time:** 2-3 days for full implementation

