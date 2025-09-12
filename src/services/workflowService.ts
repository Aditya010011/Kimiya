import { TokenManager } from './authService';
import { getApiBaseUrl } from '@/utils/envConfig';

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_email: string;
  node_count?: number;
  edge_count?: number;
  configs?: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  [key: string]: any;
}

export interface WorkflowFlow {
  workflow: { id: number; name: string };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  configs?: Record<string, any>;
}

export interface UpdateWorkflowRequest {
  name: string;
  description?: string;
  configs?: Record<string, any>;
}

export interface SaveFlowRequest {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface PaginatedWorkflowsResponse {
  workflows: Workflow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class WorkflowService {
  private static baseUrl = getApiBaseUrl();

  /**
   * Get all workflows for the authenticated user
   */
  static async getWorkflows(page = 1, limit = 10): Promise<PaginatedWorkflowsResponse> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Validate parameters
    if (page < 1) {
      throw new Error('Page number must be greater than 0');
    }
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/workflows?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }

      if (response.status === 403) {
        throw new Error('You do not have permission to access workflows.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch workflows');
      }

      // Validate response structure
      if (!data.data || !Array.isArray(data.data.workflows)) {
        throw new Error('Invalid response format from server');
      }

      return data.data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  /**
   * Get a specific workflow by ID
   */
  static async getWorkflow(id: number): Promise<Workflow> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.baseUrl}/api/workflows/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch workflow');
    }

    return data.data.workflow;
  }

  /**
   * Create a new workflow
   */
  static async createWorkflow(workflowData: CreateWorkflowRequest): Promise<Workflow> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Validate input parameters
    if (!workflowData.name || typeof workflowData.name !== 'string') {
      throw new Error('Workflow name is required and must be a string');
    }

    if (workflowData.name.trim().length === 0) {
      throw new Error('Workflow name cannot be empty');
    }

    if (workflowData.name.length > 255) {
      throw new Error('Workflow name must be less than 255 characters');
    }

    if (workflowData.description && typeof workflowData.description !== 'string') {
      throw new Error('Description must be a string');
    }

    if (workflowData.description && workflowData.description.length > 1000) {
      throw new Error('Description must be less than 1000 characters');
    }

    if (workflowData.configs && typeof workflowData.configs !== 'object') {
      throw new Error('Configs must be an object');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/workflows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...workflowData,
          name: workflowData.name.trim(),
          description: workflowData.description?.trim(),
        }),
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      }

      if (response.status === 403) {
        throw new Error('You do not have permission to create workflows.');
      }

      if (response.status === 409) {
        throw new Error('A workflow with this name already exists.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to create workflow');
      }

      // Validate response structure
      if (!data.data || !data.data.workflow) {
        throw new Error('Invalid response format from server');
      }

      return data.data.workflow;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  /**
   * Update an existing workflow
   */
  static async updateWorkflow(id: number, workflowData: UpdateWorkflowRequest): Promise<Workflow> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.baseUrl}/api/workflows/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update workflow');
    }

    return data.data.workflow;
  }

  /**
   * Delete a workflow (soft delete)
   */
  static async deleteWorkflow(id: number): Promise<void> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.baseUrl}/api/workflows/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete workflow');
    }
  }

  /**
   * Get workflow flow data (nodes and edges)
   */
  static async getWorkflowFlow(id: number): Promise<WorkflowFlow> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.baseUrl}/api/workflows/${id}/flow`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch workflow flow');
    }

    return data.data;
  }

  /**
   * Save workflow flow data (nodes and edges)
   */
  static async saveWorkflowFlow(id: number, flowData: SaveFlowRequest): Promise<void> {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${this.baseUrl}/api/workflows/${id}/flow`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flowData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to save workflow flow');
    }
  }

  /**
   * Auto-save workflow flow with debouncing
   */
  private static autoSaveTimeouts = new Map<number, NodeJS.Timeout>();

  static autoSaveWorkflowFlow(id: number, flowData: SaveFlowRequest, delay = 2000): void {
    // Clear existing timeout for this workflow
    const existingTimeout = this.autoSaveTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await this.saveWorkflowFlow(id, flowData);
        console.log(`Auto-saved workflow ${id}`);
      } catch (error) {
        console.error(`Auto-save failed for workflow ${id}:`, error);
      } finally {
        this.autoSaveTimeouts.delete(id);
      }
    }, delay);

    this.autoSaveTimeouts.set(id, timeout);
  }

  /**
   * Cancel auto-save for a workflow
   */
  static cancelAutoSave(id: number): void {
    const timeout = this.autoSaveTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.autoSaveTimeouts.delete(id);
    }
  }
}
