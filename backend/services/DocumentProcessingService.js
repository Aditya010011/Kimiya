const fs = require('fs').promises;
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { encoding_for_model } = require('tiktoken');
const axios = require('axios');

class DocumentProcessingService {
  constructor() {
    this.encoder = encoding_for_model('gpt-3.5-turbo');
    this.chunkSize = 500; // tokens (reduced for Google AI Studio's 20KB limit)
    this.chunkOverlap = 100; // tokens
    this.googleAIKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    this.defaultEmbeddingModel = 'text-embedding-004'; // Google's latest embedding model

    // Supported Google AI Studio embedding models
    this.supportedModels = {
      'text-embedding-004': {
        name: 'text-embedding-004',
        dimensions: 768,
        description: 'Latest and most stable Google embedding model'
      },
      'text-embedding-003': {
        name: 'text-embedding-003',
        dimensions: 768,
        description: 'Previous version of Google embedding model'
      },
      'embedding-001': {
        name: 'embedding-001',
        dimensions: 768,
        description: 'Legacy Google embedding model'
      }
    };
  }

  /**
   * Get the API URL for a specific embedding model
   */
  getEmbeddingApiUrl(modelName) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent`;
  }

  /**
   * Extract text from a file based on its type
   */
  async extractText(filePath, fileType) {
    try {
      console.log(`[DocumentProcessing] Extracting text from: ${filePath}`);
      console.log(`[DocumentProcessing] File type: ${fileType}`);

      if (fileType === 'application/pdf') {
        return await this.extractTextFromPDF(filePath);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractTextFromDOCX(filePath);
      } else if (fileType === 'text/plain') {
        return await this.extractTextFromTXT(filePath);
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error('[DocumentProcessing] Error extracting text:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF file
   */
  async extractTextFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      await parser.destroy(); // Free memory
      console.log(`[DocumentProcessing] Extracted ${result.text.length} characters from PDF`);
      return result.text;
    } catch (error) {
      console.error('[DocumentProcessing] Error extracting PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX file
   */
  async extractTextFromDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      console.log(`[DocumentProcessing] Extracted ${result.value.length} characters from DOCX`);
      return result.value;
    } catch (error) {
      console.error('[DocumentProcessing] Error extracting DOCX:', error);
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  /**
   * Extract text from TXT file
   */
  async extractTextFromTXT(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      console.log(`[DocumentProcessing] Extracted ${text.length} characters from TXT`);
      return text;
    } catch (error) {
      console.error('[DocumentProcessing] Error extracting TXT:', error);
      throw new Error(`Failed to extract text from TXT: ${error.message}`);
    }
  }

  /**
   * Count tokens in text
   */
  countTokens(text) {
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch (error) {
      console.error('[DocumentProcessing] Error counting tokens:', error);
      // Fallback: rough estimate (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Split text into chunks with overlap
   */
  chunkText(text, chunkSize = this.chunkSize, overlap = this.chunkOverlap) {
    try {
      console.log(`[DocumentProcessing] Chunking text (${text.length} chars) with size ${chunkSize} and overlap ${overlap}`);

      const tokens = this.encoder.encode(text);
      const chunks = [];
      let startIdx = 0;

      while (startIdx < tokens.length) {
        const endIdx = Math.min(startIdx + chunkSize, tokens.length);
        const chunkTokens = tokens.slice(startIdx, endIdx);
        const decodedText = this.encoder.decode(chunkTokens);

        // Ensure the decoded text is a string (tiktoken may return Buffer or Uint8Array)
        let chunkText;
        if (typeof decodedText === 'string') {
          chunkText = decodedText;
        } else if (Buffer.isBuffer(decodedText)) {
          chunkText = decodedText.toString('utf-8');
        } else if (decodedText instanceof Uint8Array) {
          chunkText = Buffer.from(decodedText).toString('utf-8');
        } else {
          // Fallback for any other type
          chunkText = String(decodedText);
        }

        chunks.push({
          text: chunkText,
          tokenCount: chunkTokens.length,
          startIdx,
          endIdx
        });

        // Move forward by (chunkSize - overlap) to create overlap
        startIdx += (chunkSize - overlap);
      }

      console.log(`[DocumentProcessing] Created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      console.error('[DocumentProcessing] Error chunking text:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text using Google AI Studio
   */
  async generateEmbedding(text, modelName = null) {
    try {
      if (!this.googleAIKey) {
        throw new Error('Google AI Studio API key not configured');
      }

      // Ensure text is a string
      if (typeof text !== 'string') {
        console.error('[DocumentProcessing] Invalid text type:', typeof text, text);
        throw new Error(`Text must be a string, got ${typeof text}`);
      }

      // Use provided model or default
      const model = modelName || this.defaultEmbeddingModel;

      // Validate model is supported
      if (!this.supportedModels[model]) {
        console.warn(`[DocumentProcessing] Unsupported model ${model}, using default ${this.defaultEmbeddingModel}`);
        modelName = this.defaultEmbeddingModel;
      }

      // Truncate text if it's too long (Google AI has ~20KB limit for embeddings)
      // Using conservative 10,000 characters (~20KB) to be safe
      let processedText = text.trim();
      if (processedText.length > 10000) {
        console.warn(`[DocumentProcessing] Text too long (${processedText.length} chars), truncating to 10000 chars`);
        processedText = processedText.substring(0, 10000);
      }

      // Skip empty text
      if (!processedText) {
        console.warn('[DocumentProcessing] Empty text, returning zero vector');
        return new Array(768).fill(0);
      }

      const url = `${this.getEmbeddingApiUrl(model)}?key=${this.googleAIKey}`;

      const response = await axios.post(
        url,
        {
          content: {
            parts: [{ text: processedText }]
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.embedding && response.data.embedding.values) {
        return response.data.embedding.values;
      } else {
        throw new Error('Invalid response from Google AI Studio');
      }
    } catch (error) {
      console.error('[DocumentProcessing] Error generating embedding:', error.response?.data || error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple chunks in batch
   */
  async generateEmbeddingsBatch(chunks, modelName = null, batchSize = 10) {
    try {
      const model = modelName || this.defaultEmbeddingModel;
      console.log(`[DocumentProcessing] Generating embeddings for ${chunks.length} chunks using model: ${model}`);

      const embeddings = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        console.log(`[DocumentProcessing] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

        const batchEmbeddings = await Promise.all(
          batch.map((chunk, idx) => {
            // Ensure chunk.text is a string
            const text = typeof chunk.text === 'string' ? chunk.text : String(chunk.text || '');
            if (!text || typeof text !== 'string') {
              console.error(`[DocumentProcessing] Invalid chunk at index ${i + idx}:`, chunk);
              throw new Error(`Invalid chunk text at index ${i + idx}`);
            }
            return this.generateEmbedding(text, model);
          })
        );

        embeddings.push(...batchEmbeddings);

        // Small delay to avoid rate limiting
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`[DocumentProcessing] Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('[DocumentProcessing] Error generating embeddings batch:', error);
      throw error;
    }
  }

  /**
   * Process a document: extract text, chunk, and generate embeddings
   */
  async processDocument(filePath, fileType, embeddingModel = null) {
    try {
      const model = embeddingModel || this.defaultEmbeddingModel;
      console.log(`[DocumentProcessing] Starting document processing: ${filePath}`);
      console.log(`[DocumentProcessing] Using embedding model: ${model}`);

      // Step 1: Extract text
      const text = await this.extractText(filePath, fileType);

      if (!text || text.trim().length === 0) {
        throw new Error('No text extracted from document');
      }

      // Step 2: Chunk text
      const chunks = this.chunkText(text);

      // Step 3: Generate embeddings
      const embeddings = await this.generateEmbeddingsBatch(chunks, model);

      // Combine chunks with embeddings
      const processedChunks = chunks.map((chunk, index) => ({
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[index],
        chunkIndex: index
      }));

      console.log(`[DocumentProcessing] Document processing complete: ${processedChunks.length} chunks`);

      return {
        text,
        chunks: processedChunks,
        totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        chunkCount: processedChunks.length
      };
    } catch (error) {
      console.error('[DocumentProcessing] Error processing document:', error);
      throw error;
    }
  }

  /**
   * Clean up: free encoder resources
   */
  cleanup() {
    try {
      if (this.encoder) {
        this.encoder.free();
      }
    } catch (error) {
      console.error('[DocumentProcessing] Error during cleanup:', error);
    }
  }
}

module.exports = new DocumentProcessingService();

