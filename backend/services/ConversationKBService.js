/**
 * Conversation Knowledge Base Service
 * Handles KB queries during chat/conversation flows
 * Optimized for real-time conversation context injection
 */

const ragService = require('./RAGService');
const knowledgeBaseService = require('./KnowledgeBaseService');

class ConversationKBService {
  /**
   * Query multiple knowledge bases and merge results
   * Used during conversation to retrieve relevant context
   * 
   * @param {string} query - User's query or conversation context
   * @param {string[]} kbIds - Array of knowledge base IDs to query
   * @param {number} userId - User ID for authorization
   * @param {object} config - Retrieval configuration
   * @returns {Promise<Array>} Merged and ranked results
   */
  async queryMultipleKBs(query, kbIds, userId, config = {}) {
    try {
      const {
        topK = 3,
        similarityThreshold = 0.6,
        enableQueryRewriting = true
      } = config;

      console.log(`[ConversationKB] Querying ${kbIds.length} knowledge bases for user ${userId}`);
      console.log(`[ConversationKB] Query: "${query}"`);
      console.log(`[ConversationKB] Config:`, { topK, similarityThreshold, enableQueryRewriting });

      if (!kbIds || kbIds.length === 0) {
        console.log('[ConversationKB] No knowledge bases specified');
        return [];
      }

      // Query all KBs in parallel
      const queryPromises = kbIds.map(kbId => 
        this.queryKB(kbId, query, userId, topK, enableQueryRewriting)
          .catch(error => {
            console.error(`[ConversationKB] Error querying KB ${kbId}:`, error.message);
            return []; // Return empty array on error, don't fail entire request
          })
      );

      const results = await Promise.all(queryPromises);

      // Flatten results from all KBs
      const allResults = results.flat();

      if (allResults.length === 0) {
        console.log('[ConversationKB] No results found across all knowledge bases');
        return [];
      }

      // Filter by similarity threshold
      const filteredResults = allResults.filter(r => r.score >= similarityThreshold);

      console.log(`[ConversationKB] Found ${allResults.length} total results, ${filteredResults.length} above threshold`);

      // Sort by score (descending) and take top K
      const mergedResults = filteredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      console.log(`[ConversationKB] Returning top ${mergedResults.length} results`);

      return mergedResults;

    } catch (error) {
      console.error('[ConversationKB] Error in queryMultipleKBs:', error);
      throw error;
    }
  }

  /**
   * Query a single knowledge base
   * 
   * @param {string} kbId - Knowledge base ID
   * @param {string} query - Search query
   * @param {number} userId - User ID for authorization
   * @param {number} topK - Number of results to return
   * @param {boolean} enableQueryRewriting - Whether to rewrite query
   * @returns {Promise<Array>} Search results with scores
   */
  async queryKB(kbId, query, userId, topK = 5, enableQueryRewriting = true) {
    try {
      console.log(`[ConversationKB] Querying KB ${kbId}`);

      // Get KB details (includes authorization check)
      const kb = await knowledgeBaseService.getKnowledgeBase(kbId, userId);

      if (!kb) {
        console.error(`[ConversationKB] Knowledge base ${kbId} not found or unauthorized`);
        return [];
      }

      if (!kb.is_active) {
        console.warn(`[ConversationKB] Knowledge base ${kbId} is not active`);
        return [];
      }

      // Use RAG service to search (vector search only, no LLM generation)
      const searchResponse = await ragService.search(
        kbId,
        kb.vector_collection_name,
        query,
        topK,
        kb.embedding_model,
        enableQueryRewriting
      );

      // Extract results array from response
      const searchResults = searchResponse.results || [];

      // Add KB metadata to results
      const resultsWithMetadata = searchResults.map(result => ({
        ...result,
        knowledgeBaseId: kbId,
        knowledgeBaseName: kb.name
      }));

      console.log(`[ConversationKB] KB ${kbId} returned ${resultsWithMetadata.length} results`);

      return resultsWithMetadata;

    } catch (error) {
      console.error(`[ConversationKB] Error querying KB ${kbId}:`, error);
      throw error;
    }
  }

  /**
   * Format KB results as context for LLM prompt
   * Follows Retell AI pattern: "## Related Knowledge Base Contexts"
   * 
   * @param {Array} results - Search results from queryMultipleKBs
   * @param {object} options - Formatting options
   * @returns {string} Formatted context string
   */
  formatKBContext(results, options = {}) {
    const {
      includeScores = true,
      includeKBNames = true,
      maxChunkLength = 500
    } = options;

    if (!results || results.length === 0) {
      return '';
    }

    let context = '\n\n## Related Knowledge Base Contexts\n\n';
    context += 'The following information from the knowledge base may be relevant to this conversation:\n\n';

    results.forEach((result, index) => {
      const chunkNumber = index + 1;
      let chunkText = result.text || result.chunk_text || '';

      // Truncate if too long
      if (chunkText.length > maxChunkLength) {
        chunkText = chunkText.substring(0, maxChunkLength) + '...';
      }

      context += `[${chunkNumber}] ${chunkText}`;

      // Add metadata
      const metadata = [];
      if (includeKBNames && result.knowledgeBaseName) {
        metadata.push(`Source: ${result.knowledgeBaseName}`);
      }
      if (includeScores && result.score !== undefined) {
        metadata.push(`Relevance: ${(result.score * 100).toFixed(0)}%`);
      }

      if (metadata.length > 0) {
        context += `\n   (${metadata.join(', ')})`;
      }

      context += '\n\n';
    });

    context += 'Use this information to provide accurate and helpful responses. If the information is not relevant to the current question, you may ignore it.\n';

    return context;
  }

  /**
   * Extract query from conversation messages
   * Takes the last user message as the query
   * 
   * @param {Array} messages - Conversation messages
   * @returns {string} Extracted query
   */
  extractQueryFromMessages(messages) {
    if (!messages || messages.length === 0) {
      return '';
    }

    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }

    return '';
  }

  /**
   * Main method: Query KBs and format context for conversation
   * This is the primary method used by chat endpoints
   * 
   * @param {Array} messages - Conversation messages
   * @param {string[]} kbIds - Knowledge base IDs
   * @param {number} userId - User ID
   * @param {object} config - Configuration
   * @returns {Promise<object>} { context: string, results: Array }
   */
  async getConversationContext(messages, kbIds, userId, config = {}) {
    try {
      // Extract query from messages
      const query = this.extractQueryFromMessages(messages);

      if (!query) {
        console.log('[ConversationKB] No user query found in messages');
        return { context: '', results: [] };
      }

      // Query knowledge bases
      const results = await this.queryMultipleKBs(query, kbIds, userId, config);

      // Format context
      const context = this.formatKBContext(results, config);

      return {
        context,
        results,
        query
      };

    } catch (error) {
      console.error('[ConversationKB] Error getting conversation context:', error);
      // Return empty context on error, don't fail the conversation
      return { context: '', results: [], error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new ConversationKBService();

