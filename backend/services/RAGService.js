const axios = require('axios');
const documentProcessingService = require('./DocumentProcessingService');
const vectorStoreService = require('./VectorStoreService');

class RAGService {
  constructor() {
    // Use BASE_ENDPOINT if available, otherwise extract base from full ENDPOINT
    const fullEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const baseEndpoint = process.env.AZURE_OPENAI_BASE_ENDPOINT;

    if (baseEndpoint) {
      this.azureOpenAIEndpoint = baseEndpoint;
    } else if (fullEndpoint) {
      // Extract base URL from full endpoint (remove /openai/deployments/... part)
      this.azureOpenAIEndpoint = fullEndpoint.split('/openai/deployments')[0];
    } else {
      this.azureOpenAIEndpoint = null;
    }

    this.azureOpenAIKey = process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY;
    this.azureOpenAIChatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4';
  }

  /**
   * Rewrite question to improve semantic matching
   * Converts interrogative questions to declarative statements
   */
  rewriteQuery(question) {
    const lowerQuestion = question.toLowerCase().trim();

    // Common question patterns and their rewrites
    const patterns = [
      { regex: /^who (is|are|was|were) (the )?author/i, rewrite: 'author name' },
      { regex: /^who wrote/i, rewrite: 'author name' },
      { regex: /^what (is|are) (this|the) (book|document|text) about/i, rewrite: 'book topic subject content' },
      { regex: /^what (is|are) (the )?main (topic|subject|theme)/i, rewrite: 'main topic subject theme' },
      { regex: /^when (was|were)/i, rewrite: 'date time year' },
      { regex: /^where (is|are|was|were)/i, rewrite: 'location place' },
      { regex: /^why (did|does|do)/i, rewrite: 'reason cause explanation' },
      { regex: /^how (did|does|do)/i, rewrite: 'method process way' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(lowerQuestion)) {
        console.log(`[RAG] Query rewritten: "${question}" → "${pattern.rewrite} ${question}"`);
        return `${pattern.rewrite} ${question}`;
      }
    }

    // If no pattern matches, return original question
    return question;
  }

  /**
   * Generate answer using RAG (Retrieval-Augmented Generation)
   */
  async query(knowledgeBaseId, collectionName, question, options = {}) {
    try {
      console.log(`[RAG] Processing query for KB ${knowledgeBaseId}: "${question}"`);

      const {
        topK = 5,
        temperature = 0.7,
        maxTokens = 500,
        includeSource = true,
        embeddingModel = null,
        enableQueryRewriting = true
      } = options;

      // Step 1: Rewrite query for better semantic matching (optional)
      const searchQuery = enableQueryRewriting ? this.rewriteQuery(question) : question;

      // Step 2: Generate embedding for the question
      console.log(`[RAG] Generating query embedding using model: ${embeddingModel || 'default'}...`);
      const queryEmbedding = await documentProcessingService.generateEmbedding(searchQuery, embeddingModel);

      // Step 2: Search for relevant chunks
      console.log(`[RAG] Searching for top ${topK} relevant chunks...`);
      const searchResults = await vectorStoreService.search(
        collectionName,
        queryEmbedding,
        topK
      );

      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find any relevant information in the knowledge base to answer your question.",
          sources: [],
          confidence: 0
        };
      }

      // Step 3: Prepare context from search results
      const context = searchResults
        .map((result, index) => `[${index + 1}] ${result.text}`)
        .join('\n\n');

      console.log(`[RAG] Found ${searchResults.length} relevant chunks`);

      // Step 4: Generate answer using LLM
      console.log('[RAG] Generating answer with LLM...');
      const answer = await this.generateAnswer(question, context, temperature, maxTokens);

      // Step 5: Prepare response
      const response = {
        answer: answer,
        sources: includeSource ? searchResults.map(result => ({
          documentId: result.documentId,
          chunkIndex: result.chunkIndex,
          text: result.text,
          score: result.score
        })) : [],
        confidence: searchResults[0]?.score || 0,
        chunksUsed: searchResults.length
      };

      console.log('[RAG] Query processing complete');
      return response;
    } catch (error) {
      console.error('[RAG] Error processing query:', error);
      throw error;
    }
  }

  /**
   * Generate answer using Azure OpenAI
   */
  async generateAnswer(question, context, temperature = 0.7, maxTokens = 500) {
    try {
      if (!this.azureOpenAIEndpoint || !this.azureOpenAIKey) {
        throw new Error('Azure OpenAI credentials not configured');
      }

      const url = `${this.azureOpenAIEndpoint}/openai/deployments/${this.azureOpenAIChatDeployment}/chat/completions?api-version=2023-05-15`;

      const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context.
Your task is to:
1. Answer the question using ONLY the information from the context provided
2. If the context doesn't contain enough information to answer the question, say so clearly
3. Be concise and accurate
4. Cite specific parts of the context when relevant
5. If you're unsure, express your uncertainty

Context:
${context}`;

      const response = await axios.post(
        url,
        {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: question
            }
          ],
          temperature: temperature,
          max_tokens: maxTokens,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.azureOpenAIKey
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('Invalid response from Azure OpenAI');
      }
    } catch (error) {
      console.error('[RAG] Error generating answer:', error.response?.data || error.message);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Search knowledge base without generating answer (just return relevant chunks)
   */
  async search(knowledgeBaseId, collectionName, query, topK = 5, embeddingModel = null, enableQueryRewriting = true) {
    try {
      console.log(`[RAG] Searching KB ${knowledgeBaseId} for: "${query}"`);

      // Rewrite query for better semantic matching
      const searchQuery = enableQueryRewriting ? this.rewriteQuery(query) : query;

      // Generate embedding for the query
      const queryEmbedding = await documentProcessingService.generateEmbedding(searchQuery, embeddingModel);

      // Search for relevant chunks
      const searchResults = await vectorStoreService.search(
        collectionName,
        queryEmbedding,
        topK
      );

      return {
        results: searchResults.map(result => ({
          documentId: result.documentId,
          chunkIndex: result.chunkIndex,
          text: result.text,
          score: result.score,
          tokenCount: result.tokenCount
        })),
        count: searchResults.length
      };
    } catch (error) {
      console.error('[RAG] Error searching:', error);
      throw error;
    }
  }

  /**
   * Test query with different parameters
   */
  async testQuery(knowledgeBaseId, collectionName, question, testOptions = {}) {
    try {
      const {
        topKValues = [3, 5, 10],
        temperatures = [0.3, 0.7, 1.0]
      } = testOptions;

      const results = [];

      for (const topK of topKValues) {
        for (const temperature of temperatures) {
          console.log(`[RAG] Testing with topK=${topK}, temperature=${temperature}`);
          
          const result = await this.query(knowledgeBaseId, collectionName, question, {
            topK,
            temperature,
            includeSource: false
          });

          results.push({
            topK,
            temperature,
            answer: result.answer,
            confidence: result.confidence,
            chunksUsed: result.chunksUsed
          });
        }
      }

      return {
        question,
        results,
        totalTests: results.length
      };
    } catch (error) {
      console.error('[RAG] Error in test query:', error);
      throw error;
    }
  }
}

module.exports = new RAGService();

