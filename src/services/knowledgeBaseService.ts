import axios, { AxiosProgressEvent } from 'axios';
import { getApiBaseUrl } from '../utils/envConfig';
import { TokenManager } from './authService';

const API_BASE_URL = getApiBaseUrl();

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  total_chunks: number;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  processing_status: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface SearchResult {
  id: string;
  text: string;
  score: number;
  documentId: string;
  chunkIndex: number;
  metadata?: any;
}

interface RAGResponse {
  answer: string;
  sources: Array<{
    text: string;
    score: number;
    documentId: string;
    chunkIndex: number;
  }>;
  confidence: number;
  chunksUsed: number;
}

class KnowledgeBaseService {
  private getAuthHeaders() {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  private handleError(error: any, defaultMessage: string): never {
    if (error.response?.status === 401) {
      TokenManager.clearTokens();
      throw new Error('Session expired. Please log in again.');
    }
    console.error(defaultMessage, error);
    throw new Error(error.response?.data?.error || error.response?.data?.message || defaultMessage);
  }

  /**
   * List all knowledge bases
   */
  async list(): Promise<{ knowledgeBases: KnowledgeBase[] }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/knowledge-base`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to load knowledge bases');
    }
  }

  /**
   * Get a single knowledge base by ID
   */
  async get(id: string): Promise<{ knowledgeBase: KnowledgeBase }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/knowledge-base/${id}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to load knowledge base');
    }
  }

  /**
   * Create a new knowledge base
   */
  async create(data: {
    name: string;
    description?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    embeddingModel?: string;
  }): Promise<{ knowledgeBaseId: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/knowledge-base`,
        data,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to create knowledge base');
    }
  }

  /**
   * Update a knowledge base
   */
  async update(id: string, data: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }): Promise<{ success: boolean }> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/knowledge-base/${id}`,
        data,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to update knowledge base');
    }
  }

  /**
   * Delete a knowledge base
   */
  async delete(id: string): Promise<{ success: boolean }> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/knowledge-base/${id}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to delete knowledge base');
    }
  }

  /**
   * Get documents in a knowledge base
   */
  async getDocuments(knowledgeBaseId: string): Promise<{ documents: Document[] }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/documents`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to load documents');
    }
  }

  /**
   * Upload a document to a knowledge base
   */
  async uploadDocument(
    knowledgeBaseId: string,
    formData: FormData,
    onProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<{ documentId: string; message: string }> {
    try {
      const token = TokenManager.getAccessToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: onProgress
        }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to upload document');
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(knowledgeBaseId: string, documentId: string): Promise<{ success: boolean }> {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/documents/${documentId}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to delete document');
    }
  }

  /**
   * Search knowledge base (vector search only)
   */
  async search(
    knowledgeBaseId: string,
    query: string,
    topK: number = 5
  ): Promise<{ results: SearchResult[]; responseTime: number }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/search`,
        { query, topK },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Search failed');
    }
  }

  /**
   * Process a document (extract text, chunk, generate embeddings)
   */
  async processDocument(
    knowledgeBaseId: string,
    documentId: string
  ): Promise<{ success: boolean; chunkCount: number; totalTokens: number }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/documents/${documentId}/process`,
        {},
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to process document');
    }
  }

  /**
   * Query knowledge base with RAG (search + AI response)
   */
  async query(
    knowledgeBaseId: string,
    question: string,
    options?: {
      topK?: number;
      temperature?: number;
      maxTokens?: number;
      includeSource?: boolean;
    }
  ): Promise<RAGResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/query`,
        { question, ...options },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Query failed');
    }
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(knowledgeBaseId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalQueries: number;
    avgResponseTime: number;
  }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/knowledge-base/${knowledgeBaseId}/stats`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to load statistics');
    }
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService;

