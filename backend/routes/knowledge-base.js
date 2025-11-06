/**
 * Knowledge Base Routes
 * Handles RAG (Retrieval-Augmented Generation) API endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const knowledgeBaseService = require('../services/KnowledgeBaseService');
const ragService = require('../services/RAGService');
const vectorStoreService = require('../services/VectorStoreService');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/knowledge-base');

// Ensure upload directory exists
(async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
  }
})();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

/**
 * GET /api/knowledge-base
 * List all knowledge bases for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const knowledgeBases = await knowledgeBaseService.listKnowledgeBases(userId, organizationId);

    res.json({
      success: true,
      knowledgeBases
    });
  } catch (error) {
    console.error('Error listing knowledge bases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list knowledge bases',
      message: error.message
    });
  }
});

/**
 * GET /api/knowledge-base/:id
 * Get a single knowledge base by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const knowledgeBase = await knowledgeBaseService.getKnowledgeBase(id, userId);

    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge base not found'
      });
    }

    res.json({
      success: true,
      knowledgeBase
    });
  } catch (error) {
    console.error('Error getting knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get knowledge base',
      message: error.message
    });
  }
});

/**
 * POST /api/knowledge-base
 * Create a new knowledge base
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const data = {
      ...req.body,
      organizationId
    };

    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const knowledgeBase = await knowledgeBaseService.createKnowledgeBase(userId, data);

    res.status(201).json({
      success: true,
      knowledgeBase
    });
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create knowledge base',
      message: error.message
    });
  }
});

/**
 * PUT /api/knowledge-base/:id
 * Update a knowledge base
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const data = req.body;

    const knowledgeBase = await knowledgeBaseService.updateKnowledgeBase(id, userId, data);

    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge base not found'
      });
    }

    res.json({
      success: true,
      knowledgeBase
    });
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge base',
      message: error.message
    });
  }
});

/**
 * DELETE /api/knowledge-base/:id
 * Delete a knowledge base
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await knowledgeBaseService.deleteKnowledgeBase(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge base not found'
      });
    }

    res.json({
      success: true,
      message: 'Knowledge base deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete knowledge base',
      message: error.message
    });
  }
});

/**
 * GET /api/knowledge-base/:id/documents
 * List all documents in a knowledge base
 */
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const documents = await knowledgeBaseService.listDocuments(id, userId);

    res.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list documents',
      message: error.message
    });
  }
});

/**
 * POST /api/knowledge-base/:id/upload
 * Upload a document to a knowledge base
 */
router.post('/:id/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const fileData = {
      filename: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      filePath: file.path
    };

    const document = await knowledgeBaseService.createDocument(id, userId, fileData);

    // Trigger document processing asynchronously (don't wait for it to complete)
    knowledgeBaseService.processDocument(document.id, id, userId)
      .then(result => {
        console.log(`[API] Document ${document.id} processed successfully:`, result);
      })
      .catch(error => {
        console.error(`[API] Error processing document ${document.id}:`, error);
      });

    res.status(201).json({
      success: true,
      document,
      message: 'Document uploaded successfully. Processing has started in the background.'
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload document',
      message: error.message
    });
  }
});

/**
 * DELETE /api/knowledge-base/:id/documents/:documentId
 * Delete a document from a knowledge base
 */
router.delete('/:id/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const userId = req.user.id;

    const deleted = await knowledgeBaseService.deleteDocument(documentId, id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

/**
 * GET /api/knowledge-base/:id/stats
 * Get statistics for a knowledge base
 */
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const stats = await knowledgeBaseService.getStatistics(id, userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/knowledge-base/:id/search
 * Perform vector search on a knowledge base
 */
router.post('/:id/search', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { query, topK = 5 } = req.body;
    const userId = req.user.id;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log(`[API] Vector search for KB ${id}: "${query}"`);
    const startTime = Date.now();

    // Get knowledge base to get collection name and embedding model
    const kb = await knowledgeBaseService.getKnowledgeBase(id, userId);
    if (!kb) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge base not found'
      });
    }

    // Perform vector search using RAG service
    const ragService = require('../services/RAGService');
    const searchResult = await ragService.search(
      id,
      kb.vector_collection_name,
      query,
      topK,
      kb.embedding_model
    );

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      results: searchResult.results,
      count: searchResult.count,
      responseTime
    });
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search',
      message: error.message
    });
  }
});

/**
 * POST /api/knowledge-base/:id/documents/:documentId/process
 * Process a document (extract text, chunk, generate embeddings)
 */
router.post('/:id/documents/:documentId/process', authenticateToken, async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const userId = req.user.id;

    console.log(`[API] Processing document ${documentId} for KB ${id}`);

    const result = await knowledgeBaseService.processDocument(documentId, id, userId);

    res.json({
      success: true,
      ...result,
      message: 'Document processed successfully'
    });
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process document',
      message: error.message
    });
  }
});

/**
 * POST /api/knowledge-base/:id/query
 * Perform RAG query on a knowledge base
 */
router.post('/:id/query', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, topK, temperature, maxTokens, includeSource } = req.body;
    const userId = req.user.id;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    console.log(`[API] RAG query for KB ${id}: "${question}"`);

    // Get knowledge base to get collection name
    const kb = await knowledgeBaseService.getKnowledgeBase(id, userId);
    if (!kb) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge base not found'
      });
    }

    const result = await ragService.query(id, kb.vector_collection_name, question, {
      topK: topK || 5,
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 500,
      includeSource: includeSource !== false,
      embeddingModel: kb.embedding_model
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error performing RAG query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform RAG query',
      message: error.message
    });
  }
});

/**
 * GET /api/knowledge-base/health/vector-store
 * Check vector store health
 */
router.get('/health/vector-store', authenticateToken, async (req, res) => {
  try {
    const health = await vectorStoreService.healthCheck();
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('Error checking vector store health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check vector store health',
      message: error.message
    });
  }
});

module.exports = router;

