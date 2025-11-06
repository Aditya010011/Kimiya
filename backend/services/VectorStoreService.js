const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');

class VectorStoreService {
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
    this.vectorSize = 768; // Google text-embedding-004 embedding size
  }

  /**
   * Create a collection for a knowledge base
   */
  async createCollection(collectionName) {
    try {
      console.log(`[VectorStore] Creating collection: ${collectionName}`);

      // Check if collection already exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === collectionName);

      if (exists) {
        console.log(`[VectorStore] Collection ${collectionName} already exists`);
        return { success: true, message: 'Collection already exists' };
      }

      // Create collection
      await this.client.createCollection(collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: 'Cosine'
        }
      });

      console.log(`[VectorStore] Collection ${collectionName} created successfully`);
      return { success: true, message: 'Collection created' };
    } catch (error) {
      console.error('[VectorStore] Error creating collection:', error);
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName) {
    try {
      console.log(`[VectorStore] Deleting collection: ${collectionName}`);
      await this.client.deleteCollection(collectionName);
      console.log(`[VectorStore] Collection ${collectionName} deleted successfully`);
      return { success: true, message: 'Collection deleted' };
    } catch (error) {
      console.error('[VectorStore] Error deleting collection:', error);
      throw error;
    }
  }

  /**
   * Store document chunks with embeddings
   */
  async storeChunks(collectionName, documentId, chunks) {
    try {
      console.log(`[VectorStore] Storing ${chunks.length} chunks for document ${documentId} in collection ${collectionName}`);

      // Prepare points for Qdrant
      // Use UUIDs as point IDs (Qdrant requires UUID or unsigned integer)
      const points = chunks.map((chunk, index) => ({
        id: uuidv4(),
        vector: chunk.embedding,
        payload: {
          documentId: documentId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          tokenCount: chunk.tokenCount
        }
      }));

      // Upsert points in batches
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.client.upsert(collectionName, {
          wait: true,
          points: batch
        });
        console.log(`[VectorStore] Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
      }

      console.log(`[VectorStore] Successfully stored ${points.length} chunks`);
      return { success: true, count: points.length };
    } catch (error) {
      console.error('[VectorStore] Error storing chunks:', error);
      throw error;
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocumentChunks(collectionName, documentId) {
    try {
      console.log(`[VectorStore] Deleting chunks for document ${documentId} from collection ${collectionName}`);

      await this.client.delete(collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId
              }
            }
          ]
        }
      });

      console.log(`[VectorStore] Deleted chunks for document ${documentId}`);
      return { success: true };
    } catch (error) {
      console.error('[VectorStore] Error deleting document chunks:', error);
      throw error;
    }
  }

  /**
   * Search for similar chunks
   */
  async search(collectionName, queryEmbedding, limit = 5, filter = null) {
    try {
      console.log(`[VectorStore] Searching in collection ${collectionName} with limit ${limit}`);

      const searchParams = {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
        with_vector: false
      };

      if (filter) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(collectionName, searchParams);

      console.log(`[VectorStore] Found ${results.length} results`);

      return results.map(result => {
        // Handle text that might be stored as Buffer (from old data)
        let text = result.payload.text;

        // Check if text is a Buffer-like object (has numeric keys)
        if (text && typeof text === 'object') {
          // Check if it's a Buffer-like object with numeric keys
          const keys = Object.keys(text);
          if (keys.length > 0 && !isNaN(keys[0])) {
            // Convert Buffer-like object to string
            const values = Object.values(text);
            text = Buffer.from(values).toString('utf-8');
            console.log(`[VectorStore] Converted Buffer to string for chunk ${result.payload.chunkIndex} (${text.length} chars)`);
          }
        }

        // Ensure text is a string
        if (typeof text !== 'string') {
          console.warn(`[VectorStore] Text is not a string for chunk ${result.payload.chunkIndex}, type: ${typeof text}`);
          text = String(text);
        }

        return {
          id: result.id,
          score: result.score,
          documentId: result.payload.documentId,
          chunkIndex: result.payload.chunkIndex,
          text: text,
          tokenCount: result.payload.tokenCount
        };
      });
    } catch (error) {
      console.error('[VectorStore] Error searching:', error);
      throw error;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName) {
    try {
      const info = await this.client.getCollection(collectionName);
      return {
        name: collectionName,
        vectorsCount: info.vectors_count,
        pointsCount: info.points_count,
        status: info.status
      };
    } catch (error) {
      console.error('[VectorStore] Error getting collection info:', error);
      throw error;
    }
  }

  /**
   * List all collections
   */
  async listCollections() {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.map(c => c.name);
    } catch (error) {
      console.error('[VectorStore] Error listing collections:', error);
      throw error;
    }
  }

  /**
   * Check if Qdrant is healthy
   */
  async healthCheck() {
    try {
      const collections = await this.client.getCollections();
      return {
        healthy: true,
        collectionsCount: collections.collections.length
      };
    } catch (error) {
      console.error('[VectorStore] Health check failed:', error);
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = new VectorStoreService();

