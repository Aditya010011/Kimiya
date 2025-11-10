/**
 * Knowledge Base Service
 * Handles RAG (Retrieval-Augmented Generation) operations
 */

const databaseService = require('./database');
const { v4: uuidv4 } = require('uuid');
const documentProcessingService = require('./DocumentProcessingService');
const vectorStoreService = require('./VectorStoreService');

class KnowledgeBaseService {
  /**
   * Generate unique ID with prefix
   */
  generateId(prefix = 'kb') {
    return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  }

  /**
   * List all knowledge bases for a user
   */
  async listKnowledgeBases(userId, organizationId = null) {
    try {
      const pool = await databaseService.getPool();
      
      let query = `
        SELECT 
          kb.id,
          kb.name,
          kb.description,
          kb.embedding_model,
          kb.chunk_size,
          kb.chunk_overlap,
          kb.vector_collection_name,
          kb.is_active,
          kb.created_at,
          kb.updated_at,
          COUNT(DISTINCT d.id) as document_count,
          ISNULL(SUM(d.chunk_count), 0) as total_chunks
        FROM tblKnowledgeBases kb
        LEFT JOIN tblDocuments d ON kb.id = d.knowledge_base_id
        WHERE kb.user_id = @userId
      `;

      if (organizationId) {
        query += ` AND kb.organization_id = @organizationId`;
      }

      query += `
        GROUP BY 
          kb.id, kb.name, kb.description, kb.embedding_model,
          kb.chunk_size, kb.chunk_overlap, kb.vector_collection_name,
          kb.is_active, kb.created_at, kb.updated_at
        ORDER BY kb.created_at DESC
      `;

      const request = pool.request();
      request.input('userId', userId);
      if (organizationId) {
        request.input('organizationId', organizationId);
      }

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error listing knowledge bases:', error);
      throw error;
    }
  }

  /**
   * Get a single knowledge base by ID
   */
  async getKnowledgeBase(id, userId) {
    try {
      const pool = await databaseService.getPool();
      
      const result = await pool.request()
        .input('id', id)
        .input('userId', userId)
        .query(`
          SELECT 
            kb.*,
            COUNT(DISTINCT d.id) as document_count,
            ISNULL(SUM(d.chunk_count), 0) as total_chunks
          FROM tblKnowledgeBases kb
          LEFT JOIN tblDocuments d ON kb.id = d.knowledge_base_id
          WHERE kb.id = @id AND kb.user_id = @userId
          GROUP BY 
            kb.id, kb.user_id, kb.organization_id, kb.name, kb.description,
            kb.embedding_model, kb.chunk_size, kb.chunk_overlap,
            kb.vector_collection_name, kb.is_active, kb.created_at, kb.updated_at
        `);

      if (result.recordset.length === 0) {
        return null;
      }

      return result.recordset[0];
    } catch (error) {
      console.error('Error getting knowledge base:', error);
      throw error;
    }
  }

  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(userId, data) {
    try {
      const pool = await databaseService.getPool();
      const id = this.generateId('kb');
      const collectionName = `kb_${id}`;

      await pool.request()
        .input('id', id)
        .input('userId', userId)
        .input('organizationId', data.organizationId || null)
        .input('name', data.name)
        .input('description', data.description || null)
        .input('embeddingModel', data.embeddingModel || 'text-embedding-004')
        .input('chunkSize', data.chunkSize || 1000)
        .input('chunkOverlap', data.chunkOverlap || 200)
        .input('collectionName', collectionName)
        .query(`
          INSERT INTO tblKnowledgeBases (
            id, user_id, organization_id, name, description,
            embedding_model, chunk_size, chunk_overlap,
            vector_collection_name, is_active, created_at, updated_at
          )
          VALUES (
            @id, @userId, @organizationId, @name, @description,
            @embeddingModel, @chunkSize, @chunkOverlap,
            @collectionName, 1, GETDATE(), GETDATE()
          )
        `);

      return await this.getKnowledgeBase(id, userId);
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      throw error;
    }
  }

  /**
   * Update a knowledge base
   */
  async updateKnowledgeBase(id, userId, data) {
    try {
      const pool = await databaseService.getPool();

      await pool.request()
        .input('id', id)
        .input('userId', userId)
        .input('name', data.name)
        .input('description', data.description || null)
        .input('isActive', data.isActive !== undefined ? data.isActive : true)
        .query(`
          UPDATE tblKnowledgeBases
          SET 
            name = @name,
            description = @description,
            is_active = @isActive,
            updated_at = GETDATE()
          WHERE id = @id AND user_id = @userId
        `);

      return await this.getKnowledgeBase(id, userId);
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      throw error;
    }
  }

  /**
   * Delete a knowledge base
   */
  async deleteKnowledgeBase(id, userId) {
    try {
      const pool = await databaseService.getPool();

      const result = await pool.request()
        .input('id', id)
        .input('userId', userId)
        .query(`
          DELETE FROM tblKnowledgeBases
          WHERE id = @id AND user_id = @userId
        `);

      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      throw error;
    }
  }

  /**
   * List documents in a knowledge base
   */
  async listDocuments(knowledgeBaseId, userId) {
    try {
      const pool = await databaseService.getPool();

      const result = await pool.request()
        .input('knowledgeBaseId', knowledgeBaseId)
        .input('userId', userId)
        .query(`
          SELECT d.*
          FROM tblDocuments d
          INNER JOIN tblKnowledgeBases kb ON d.knowledge_base_id = kb.id
          WHERE d.knowledge_base_id = @knowledgeBaseId 
            AND kb.user_id = @userId
          ORDER BY d.created_at DESC
        `);

      return result.recordset;
    } catch (error) {
      console.error('Error listing documents:', error);
      throw error;
    }
  }

  /**
   * Create a document record (file upload will be handled separately)
   */
  async createDocument(knowledgeBaseId, userId, fileData) {
    try {
      console.log('[KnowledgeBaseService] Creating document:', {
        knowledgeBaseId,
        userId,
        filename: fileData.filename,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize
      });

      const pool = await databaseService.getPool();
      const id = this.generateId('doc');

      // Verify knowledge base belongs to user
      console.log('[KnowledgeBaseService] Verifying knowledge base ownership...');
      const kb = await this.getKnowledgeBase(knowledgeBaseId, userId);
      if (!kb) {
        throw new Error('Knowledge base not found');
      }
      console.log('[KnowledgeBaseService] Knowledge base verified:', kb.name);

      console.log('[KnowledgeBaseService] Inserting document record...');
      const sql = require('mssql');
      await pool.request()
        .input('id', sql.VarChar(50), id)
        .input('knowledgeBaseId', sql.VarChar(50), knowledgeBaseId)
        .input('filename', sql.NVarChar(255), fileData.filename)
        .input('fileType', sql.VarChar(100), fileData.fileType)
        .input('fileSize', sql.BigInt, fileData.fileSize)
        .input('filePath', sql.NVarChar(sql.MAX), fileData.filePath)
        .query(`
          INSERT INTO tblDocuments (
            id, knowledge_base_id, filename, file_type, file_size,
            file_path, processing_status, created_at
          )
          VALUES (
            @id, @knowledgeBaseId, @filename, @fileType, @fileSize,
            @filePath, 'pending', GETDATE()
          )
        `);

      console.log('[KnowledgeBaseService] Document record inserted, fetching...');
      const result = await pool.request()
        .input('id', id)
        .query('SELECT * FROM tblDocuments WHERE id = @id');

      console.log('[KnowledgeBaseService] Document created successfully:', id);
      return result.recordset[0];
    } catch (error) {
      console.error('[KnowledgeBaseService] Error creating document:', error);
      console.error('[KnowledgeBaseService] Error details:', {
        message: error.message,
        code: error.code,
        number: error.number,
        state: error.state,
        class: error.class,
        serverName: error.serverName,
        procName: error.procName,
        lineNumber: error.lineNumber
      });
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId, knowledgeBaseId, userId) {
    try {
      const pool = await databaseService.getPool();

      const result = await pool.request()
        .input('documentId', documentId)
        .input('knowledgeBaseId', knowledgeBaseId)
        .input('userId', userId)
        .query(`
          DELETE d
          FROM tblDocuments d
          INNER JOIN tblKnowledgeBases kb ON d.knowledge_base_id = kb.id
          WHERE d.id = @documentId 
            AND d.knowledge_base_id = @knowledgeBaseId
            AND kb.user_id = @userId
        `);

      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStatistics(knowledgeBaseId, userId) {
    try {
      const kb = await this.getKnowledgeBase(knowledgeBaseId, userId);
      if (!kb) {
        throw new Error('Knowledge base not found');
      }

      return {
        document_count: kb.document_count || 0,
        total_chunks: kb.total_chunks || 0,
        embedding_model: kb.embedding_model,
        chunk_size: kb.chunk_size,
        chunk_overlap: kb.chunk_overlap
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Process a document: extract text, chunk, generate embeddings, and store in vector DB
   */
  async processDocument(documentId, knowledgeBaseId, userId) {
    try {
      console.log(`[KnowledgeBaseService] Processing document ${documentId}`);
      const pool = await databaseService.getPool();

      // Get document details
      const docResult = await pool.request()
        .input('documentId', documentId)
        .input('knowledgeBaseId', knowledgeBaseId)
        .input('userId', userId)
        .query(`
          SELECT d.*, kb.vector_collection_name, kb.chunk_size, kb.chunk_overlap, kb.embedding_model
          FROM tblDocuments d
          INNER JOIN tblKnowledgeBases kb ON d.knowledge_base_id = kb.id
          WHERE d.id = @documentId
            AND d.knowledge_base_id = @knowledgeBaseId
            AND kb.user_id = @userId
        `);

      if (docResult.recordset.length === 0) {
        throw new Error('Document not found');
      }

      const document = docResult.recordset[0];
      const collectionName = document.vector_collection_name;

      // Update status to processing
      await pool.request()
        .input('documentId', documentId)
        .query(`
          UPDATE tblDocuments
          SET processing_status = 'processing'
          WHERE id = @documentId
        `);

      try {
        // Ensure collection exists
        await vectorStoreService.createCollection(collectionName);

        // Process document with the knowledge base's settings
        const result = await documentProcessingService.processDocument(
          document.file_path,
          document.file_type,
          document.embedding_model,
          document.chunk_size,
          document.chunk_overlap
        );

        // Store chunks in vector database
        await vectorStoreService.storeChunks(
          collectionName,
          documentId,
          result.chunks
        );

        // Store chunks in SQL database
        const sql = require('mssql');
        for (const chunk of result.chunks) {
          const chunkId = this.generateId('chunk');

          // Ensure chunk.text is a valid string
          const chunkText = chunk.text != null ? String(chunk.text) : '';

          // Validate that we have a valid string
          if (typeof chunkText !== 'string') {
            console.error(`[KnowledgeBaseService] Invalid chunk text type for chunk ${chunk.chunkIndex}:`, typeof chunkText);
            throw new Error(`Invalid chunk text type: ${typeof chunkText}`);
          }

          await pool.request()
            .input('id', sql.VarChar(50), chunkId)
            .input('documentId', sql.VarChar(50), documentId)
            .input('chunkIndex', sql.Int, chunk.chunkIndex)
            .input('chunkText', sql.NVarChar(sql.MAX), chunkText)
            .input('vectorId', sql.VarChar(100), `${documentId}_chunk_${chunk.chunkIndex}`)
            .input('tokenCount', sql.Int, chunk.tokenCount)
            .query(`
              INSERT INTO tblDocumentChunks (
                id, document_id, chunk_index, chunk_text,
                vector_id, token_count, created_at
              )
              VALUES (
                @id, @documentId, @chunkIndex, @chunkText,
                @vectorId, @tokenCount, GETDATE()
              )
            `);
        }

        // Update document status to completed
        await pool.request()
          .input('documentId', documentId)
          .input('chunkCount', result.chunkCount)
          .query(`
            UPDATE tblDocuments
            SET processing_status = 'completed',
                chunk_count = @chunkCount,
                processed_at = GETDATE(),
                error_message = NULL
            WHERE id = @documentId
          `);

        console.log(`[KnowledgeBaseService] Document ${documentId} processed successfully`);
        return {
          success: true,
          documentId,
          chunkCount: result.chunkCount,
          totalTokens: result.totalTokens
        };
      } catch (processingError) {
        // Update status to failed
        await pool.request()
          .input('documentId', documentId)
          .input('errorMessage', processingError.message)
          .query(`
            UPDATE tblDocuments
            SET processing_status = 'failed',
                error_message = @errorMessage
            WHERE id = @documentId
          `);

        throw processingError;
      }
    } catch (error) {
      console.error('[KnowledgeBaseService] Error processing document:', error);
      throw error;
    }
  }
}

module.exports = new KnowledgeBaseService();

