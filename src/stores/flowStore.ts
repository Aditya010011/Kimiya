import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { Node, Edge, Connection, addEdge } from '@xyflow/react';
import { ComponentDefinition, FlowComponent } from '../types/componentTypes';
import { ConditionalEdge, ExtractedVariable, ConditionType, WorkflowContext } from '../types/flowTypes';
import { WorkflowConfig } from '../types/workflowConfig';
import { WorkflowService, Workflow, WorkflowNode, WorkflowEdge } from '../services/workflowService';

interface FlowState {
  // Flow data
  nodes: Node[];
  edges: ConditionalEdge[];
  workflowName: string;

  // Workflow database integration
  currentWorkflowId: number | null;
  currentWorkflow: Workflow | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;

  // Workflow configuration
  workflowConfig: WorkflowConfig | null;

  // Workflow context for variables and conditions
  workflowContext: WorkflowContext;

  // UI state
  selectedNodeId: string | null;
  isConfigPanelOpen: boolean;
  sidebarCollapsed: boolean;

  // Component registry
  componentRegistry: Map<string, ComponentDefinition>;
  
  // Actions
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: ConditionalEdge[] | ((edges: ConditionalEdge[]) => ConditionalEdge[])) => void;
  setWorkflowName: (name: string) => void;

  // Workflow configuration
  setWorkflowConfig: (config: WorkflowConfig) => void;
  updateWorkflowConfig: (updates: Partial<WorkflowConfig>) => void;

  // Node operations
  addNode: (component: FlowComponent, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;

  // Edge operations
  onConnect: (connection: Connection) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdgeCondition: (edgeId: string, conditionData: any) => void;

  // Variable operations
  addVariable: (variable: ExtractedVariable) => void;
  updateVariable: (variableName: string, updates: Partial<ExtractedVariable>) => void;
  deleteVariable: (variableName: string) => void;
  getAvailableVariables: () => ExtractedVariable[];
  addDefaultVariables: () => void;
  
  // Selection
  selectNode: (nodeId: string | null) => void;
  
  // UI actions
  toggleConfigPanel: () => void;
  toggleSidebar: () => void;
  
  // Component registry
  registerComponent: (definition: ComponentDefinition) => void;
  getComponent: (type: string) => ComponentDefinition | undefined;
  getAllComponents: () => ComponentDefinition[];

  // Flow operations
  saveFlow: () => void;
  loadFlow: (flowData: any) => void;
  importFlow: (flowData: any) => void;
  newFlow: (config?: WorkflowConfig) => void;
  initializeFromStorage: () => void;

  // Database workflow operations
  createWorkflow: (name: string, description?: string) => Promise<void>;
  loadWorkflow: (workflowId: number) => Promise<void>;
  saveWorkflowToDatabase: () => Promise<void>;
  autoSaveToDatabase: () => void;
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  markUnsavedChanges: () => void;
  clearUnsavedChanges: () => void;
}

let nodeIdCounter = 0;
const generateNodeId = () => `node_${++nodeIdCounter}`;

// Function to load saved workflow from localStorage
const loadSavedWorkflow = () => {
  try {
    const savedWorkflow = localStorage.getItem('langflow_workflow');
    if (savedWorkflow) {
      return JSON.parse(savedWorkflow);
    }
  } catch (error) {
    console.error('Error loading saved workflow:', error);
  }
  return null;
};

// Don't load saved workflow immediately - wait for components to be registered
// const savedWorkflow = loadSavedWorkflow();

// Auto-save function with debouncing
let autoSaveTimeout: NodeJS.Timeout | null = null;
const autoSave = (store: any) => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  autoSaveTimeout = setTimeout(() => {
    console.log('💾 Auto-save triggered');
    // Use database auto-save if workflow ID exists, otherwise use localStorage
    if (store.currentWorkflowId) {
      store.autoSaveToDatabase();
    } else {
      store.saveFlow();
    }
  }, 2000); // Auto-save after 2 seconds of inactivity
};

export const useFlowStore = create<FlowState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state - empty until components are registered and storage is loaded
      nodes: [],
      edges: [],
      workflowName: 'New Workflow',

      // Workflow database integration
      currentWorkflowId: null,
      currentWorkflow: null,
      isLoading: false,
      isSaving: false,
      lastSaved: null,
      hasUnsavedChanges: false,

      workflowConfig: null,
      workflowContext: {
        variables: new Map(),
        executionPath: []
      },
      selectedNodeId: null,
      isConfigPanelOpen: false,
      sidebarCollapsed: false,
      componentRegistry: new Map(),
      
      // Node operations
      setNodes: (nodes) => set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes
      })),
      
      setEdges: (edges) => set((state) => ({
        edges: typeof edges === 'function' ? edges(state.edges) : edges
      })),
      
      setWorkflowName: (name) => set({ workflowName: name }),

      // Workflow configuration
      setWorkflowConfig: (config) => {
        set({
          workflowConfig: config,
          workflowName: config.name
        });
        // Auto-save after config update
        autoSave(get());
      },

      updateWorkflowConfig: (updates) => {
        set((state) => ({
          workflowConfig: state.workflowConfig
            ? { ...state.workflowConfig, ...updates, updatedAt: new Date().toISOString() }
            : null
        }));
        // Auto-save after config update
        autoSave(get());
      },
      
      addNode: (component, position) => {
        const newNode: Node = {
          id: generateNodeId(),
          type: component.type,
          position,
          data: {
            ...component.defaultData,
            label: component.displayName,
            component: component
          }
        };
        
        set((state) => ({
          nodes: [...state.nodes, newNode],
          hasUnsavedChanges: true
        }));

        // Trigger auto-save
        autoSave(get());
      },
      
      updateNode: (nodeId, data) => {
        set((state) => ({
          nodes: state.nodes.map(node =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } }
              : node
          ),
          hasUnsavedChanges: true
        }));

        // Trigger auto-save
        autoSave(get());
      },
      
      deleteNode: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.filter(node => node.id !== nodeId),
          edges: state.edges.filter(edge =>
            edge.source !== nodeId && edge.target !== nodeId
          ),
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          hasUnsavedChanges: true
        }));

        // Trigger auto-save
        autoSave(get());
      },
      
      // Edge operations
      onConnect: (connection) => {
        // Create a conditional edge with default settings
        const newEdge: ConditionalEdge = {
          ...addEdge(connection, [])[0],
          data: {
            type: ConditionType.NONE,
            isDefault: false
          },
          type: 'conditional'
        };

        set((state) => ({
          edges: [...state.edges, newEdge],
          hasUnsavedChanges: true
        }));

        // Trigger auto-save
        autoSave(get());
      },

      deleteEdge: (edgeId) => {
        set((state) => ({
          edges: state.edges.filter(edge => edge.id !== edgeId),
          hasUnsavedChanges: true
        }));

        // Trigger auto-save
        autoSave(get());
      },

      updateEdgeCondition: (edgeId, conditionData) => {
        set((state) => ({
          edges: state.edges.map(edge =>
            edge.id === edgeId
              ? { ...edge, data: conditionData }
              : edge
          ),
          hasUnsavedChanges: true
        }));

        // Trigger auto-save
        autoSave(get());
      },
      
      // Selection
      selectNode: (nodeId) => set({ 
        selectedNodeId: nodeId,
        isConfigPanelOpen: nodeId !== null
      }),
      
      // UI actions
      toggleConfigPanel: () => set((state) => ({
        isConfigPanelOpen: !state.isConfigPanelOpen
      })),
      
      toggleSidebar: () => set((state) => ({
        sidebarCollapsed: !state.sidebarCollapsed
      })),

      // Variable operations
      addVariable: (variable) => set((state) => ({
        workflowContext: {
          ...state.workflowContext,
          variables: new Map(state.workflowContext.variables).set(variable.name, variable)
        }
      })),

      updateVariable: (variableName, updates) => set((state) => {
        const variables = new Map(state.workflowContext.variables);
        const existing = variables.get(variableName);
        if (existing) {
          variables.set(variableName, { ...existing, ...updates });
        }
        return {
          workflowContext: {
            ...state.workflowContext,
            variables
          }
        };
      }),

      deleteVariable: (variableName) => set((state) => {
        const variables = new Map(state.workflowContext.variables);
        variables.delete(variableName);
        return {
          workflowContext: {
            ...state.workflowContext,
            variables
          }
        };
      }),

      getAvailableVariables: () => {
        const state = get();
        return Array.from(state.workflowContext.variables.values());
      },

      // Helper function to add some default variables for testing
      addDefaultVariables: () => set((state) => {
        const defaultVariables = new Map(state.workflowContext.variables);

        // Add some common variables if they don't exist
        if (!defaultVariables.has('user_input')) {
          defaultVariables.set('user_input', {
            name: 'user_input',
            type: 'string' as any,
            description: 'User input from conversation',
            nodeId: 'system'
          });
        }

        if (!defaultVariables.has('call_duration')) {
          defaultVariables.set('call_duration', {
            name: 'call_duration',
            type: 'number' as any,
            description: 'Duration of the call in seconds',
            nodeId: 'system'
          });
        }

        if (!defaultVariables.has('api_status')) {
          defaultVariables.set('api_status', {
            name: 'api_status',
            type: 'number' as any,
            description: 'HTTP status code from API request',
            nodeId: 'system'
          });
        }

        return {
          workflowContext: {
            ...state.workflowContext,
            variables: defaultVariables
          }
        };
      }),
      
      // Component registry
      registerComponent: (definition) => set((state) => {
        const newRegistry = new Map(state.componentRegistry);
        newRegistry.set(definition.type, definition);
        return { componentRegistry: newRegistry };
      }),
      
      getComponent: (type) => {
        return get().componentRegistry.get(type);
      },
      
      getAllComponents: () => {
        return Array.from(get().componentRegistry.values());
      },
      
      // Flow operations
      saveFlow: () => {
        const { nodes, edges, workflowName, workflowConfig, workflowContext } = get();
        console.log('💾 saveFlow: Saving workflow with', nodes.length, 'nodes and', edges.length, 'edges');

        const flowData = {
          name: workflowName,
          config: workflowConfig,
          nodes: nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              component: undefined // Remove component reference for serialization
            }
          })),
          edges,
          variables: Array.from(workflowContext.variables.entries()).filter(([key, value]) =>
            key !== null && key !== undefined && value !== null && value !== undefined
          ), // Convert Map to array for serialization, filtering out invalid entries
          executionPath: workflowContext.executionPath,
          savedAt: new Date().toISOString()
        };

        // Save to localStorage
        localStorage.setItem('langflow_workflow', JSON.stringify(flowData));
        console.log('✅ saveFlow: Flow saved successfully:', {
          name: flowData.name,
          nodes: flowData.nodes.length,
          edges: flowData.edges.length
        });
      },
      
      loadFlow: (flowData) => {
        // Safely handle variables conversion
        let variablesMap = new Map();
        if (flowData.variables) {
          try {
            if (Array.isArray(flowData.variables)) {
              // Check if it's an array of [key, value] pairs (exported format)
              if (flowData.variables.length > 0 && Array.isArray(flowData.variables[0])) {
                // Filter out null/invalid entries
                const validVariables = flowData.variables.filter(entry =>
                  entry &&
                  Array.isArray(entry) &&
                  entry.length === 2 &&
                  entry[0] !== null &&
                  entry[0] !== undefined
                );
                variablesMap = new Map(validVariables);
              } else {
                // It's an array of variable objects (original format)
                // Convert to Map format: variable name -> variable object
                flowData.variables.forEach(variable => {
                  if (variable && variable.name) {
                    variablesMap.set(variable.name, variable);
                  }
                });
              }
            }
          } catch (error) {
            console.warn('Failed to load variables, using empty Map:', error);
            variablesMap = new Map();
          }
        }

        // Restore component references to loaded nodes
        console.log('🔄 loadFlow: Restoring component references...');
        const restoredNodes = (flowData.nodes || []).map((node: any) => {
          const componentDef = get().getComponent(node.type);
          if (componentDef) {
            console.log(`✅ loadFlow: Restored component for ${node.type}`);
            return {
              ...node,
              data: {
                ...node.data,
                component: componentDef
              }
            };
          } else {
            console.warn(`⚠️ loadFlow: Component definition not found for node type: ${node.type}`);
            return node;
          }
        });

        console.log('📝 loadFlow: Setting state with restored nodes:', restoredNodes.length);
        set({
          nodes: restoredNodes,
          edges: flowData.edges || [],
          workflowName: flowData.name || 'Loaded Workflow',
          workflowConfig: flowData.config || null,
          workflowContext: {
            variables: variablesMap,
            executionPath: flowData.executionPath || []
          }
        });
        console.log('✅ loadFlow: State updated successfully');
      },

      importFlow: (flowData) => {
        console.log('📥 importFlow: Starting import process...');

        try {
          // Validate the imported data
          if (!flowData || typeof flowData !== 'object') {
            throw new Error('Invalid workflow data format');
          }

          if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
            console.warn('⚠️ importFlow: No valid nodes found, creating empty workflow');
            flowData.nodes = [];
          }

          if (!flowData.edges || !Array.isArray(flowData.edges)) {
            console.warn('⚠️ importFlow: No valid edges found, creating empty edges');
            flowData.edges = [];
          }

          console.log('📊 importFlow: Importing workflow with', flowData.nodes.length, 'nodes and', flowData.edges.length, 'edges');

          // Restore component references for imported nodes
          const restoredNodes = flowData.nodes.map((node: any) => {
            const componentDef = get().getComponent(node.type);
            if (componentDef) {
              console.log(`✅ importFlow: Restored component for ${node.type}`);
              return {
                ...node,
                data: {
                  ...node.data,
                  component: componentDef
                }
              };
            } else {
              console.warn(`⚠️ importFlow: Component not found for type: ${node.type}`);
              return node;
            }
          });

          // Handle variables
          let variablesMap = new Map();
          if (flowData.variables) {
            try {
              if (Array.isArray(flowData.variables)) {
                if (flowData.variables.length > 0 && Array.isArray(flowData.variables[0])) {
                  variablesMap = new Map(flowData.variables);
                } else {
                  flowData.variables.forEach((variable: any) => {
                    if (variable && variable.name) {
                      variablesMap.set(variable.name, variable);
                    }
                  });
                }
              }
            } catch (error) {
              console.warn('⚠️ importFlow: Failed to load variables:', error);
            }
          }

          // Set the imported workflow state
          set({
            nodes: restoredNodes,
            edges: flowData.edges,
            workflowName: flowData.name || 'Imported Workflow',
            workflowConfig: flowData.config || null,
            workflowContext: {
              variables: variablesMap,
              executionPath: flowData.executionPath || []
            }
          });

          // Save to localStorage for persistence
          const savedData = {
            ...flowData,
            nodes: restoredNodes,
            savedAt: new Date().toISOString(),
            importedAt: new Date().toISOString()
          };
          localStorage.setItem('langflow_workflow', JSON.stringify(savedData));

          console.log('✅ importFlow: Import completed successfully');

        } catch (error) {
          console.error('❌ importFlow: Import failed:', error);
          throw error;
        }
      },

      newFlow: (config) => {
        set({
          nodes: [],
          edges: [],
          workflowName: config?.name || 'New Workflow',
          workflowConfig: config || null,
          workflowContext: {
            variables: new Map(),
            executionPath: []
          },
          selectedNodeId: null,
          isConfigPanelOpen: false
        });
      },

      initializeFromStorage: () => {
        console.log('🔍 initializeFromStorage: Starting...');

        try {
          const savedWorkflow = loadSavedWorkflow();
          if (!savedWorkflow) {
            console.log('📭 initializeFromStorage: No saved workflow found');
            return;
          }

          console.log('📂 initializeFromStorage: Found saved workflow:', savedWorkflow.name);

          // Basic validation
          if (!savedWorkflow.nodes || !Array.isArray(savedWorkflow.nodes)) {
            console.warn('⚠️ Invalid workflow: nodes is not an array');
            return;
          }

          // Load the workflow directly using set() instead of loadFlow()
          console.log('🔄 initializeFromStorage: Setting state directly...');

          // Restore component references
          const restoredNodes = savedWorkflow.nodes.map((node: any) => {
            const componentDef = get().getComponent(node.type);
            if (componentDef) {
              return {
                ...node,
                data: {
                  ...node.data,
                  component: componentDef
                }
              };
            }
            console.warn(`⚠️ Component not found for type: ${node.type}`);
            return node;
          });

          // Set the state
          set({
            nodes: restoredNodes,
            edges: savedWorkflow.edges || [],
            workflowName: savedWorkflow.name || 'Loaded Workflow',
            workflowConfig: savedWorkflow.config || null,
            workflowContext: {
              variables: new Map(),
              executionPath: savedWorkflow.executionPath || []
            }
          });

          console.log('✅ initializeFromStorage: State set successfully');
          console.log('📊 Final state:', {
            nodes: restoredNodes.length,
            edges: (savedWorkflow.edges || []).length,
            name: savedWorkflow.name
          });

        } catch (error) {
          console.error('❌ Error in initializeFromStorage:', error);
        }
      },

      // Database workflow operations
      createWorkflow: async (name: string, description?: string) => {
        set({ isLoading: true });
        try {
          const workflow = await WorkflowService.createWorkflow({ name, description });
          set({
            currentWorkflowId: workflow.id,
            currentWorkflow: workflow,
            workflowName: workflow.name,
            hasUnsavedChanges: false,
            lastSaved: new Date(),
            isLoading: false
          });
          console.log('✅ Workflow created:', workflow.name);
        } catch (error) {
          console.error('❌ Failed to create workflow:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      loadWorkflow: async (workflowId: number) => {
        set({ isLoading: true });
        try {
          // Load workflow metadata
          const workflow = await WorkflowService.getWorkflow(workflowId);

          // Load workflow flow data
          const flowData = await WorkflowService.getWorkflowFlow(workflowId);

          // Convert database format to React Flow format
          const nodes = flowData.nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              component: get().getComponent(node.type)
            }
          }));

          set({
            currentWorkflowId: workflow.id,
            currentWorkflow: workflow,
            workflowName: workflow.name,
            nodes,
            edges: flowData.edges as ConditionalEdge[],
            hasUnsavedChanges: false,
            lastSaved: new Date(workflow.updated_at),
            isLoading: false
          });

          console.log('✅ Workflow loaded:', workflow.name);
        } catch (error) {
          console.error('❌ Failed to load workflow:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      saveWorkflowToDatabase: async () => {
        const { currentWorkflowId, nodes, edges } = get();
        if (!currentWorkflowId) {
          throw new Error('No current workflow to save');
        }

        set({ isSaving: true });
        try {
          // Convert React Flow format to database format
          const workflowNodes: WorkflowNode[] = nodes.map(node => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: { ...node.data }
          }));

          const workflowEdges: WorkflowEdge[] = edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            ...edge.data
          }));

          await WorkflowService.saveWorkflowFlow(currentWorkflowId, {
            nodes: workflowNodes,
            edges: workflowEdges
          });

          set({
            hasUnsavedChanges: false,
            lastSaved: new Date(),
            isSaving: false
          });

          console.log('✅ Workflow saved to database');
        } catch (error) {
          console.error('❌ Failed to save workflow:', error);
          set({ isSaving: false });
          throw error;
        }
      },

      autoSaveToDatabase: () => {
        const { currentWorkflowId, hasUnsavedChanges, isSaving } = get();
        if (!currentWorkflowId || !hasUnsavedChanges || isSaving) {
          return;
        }

        WorkflowService.autoSaveWorkflowFlow(
          currentWorkflowId,
          {
            nodes: get().nodes.map(node => ({
              id: node.id,
              type: node.type,
              position: node.position,
              data: { ...node.data }
            })),
            edges: get().edges.map(edge => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              type: edge.type,
              ...edge.data
            }))
          }
        );

        set({
          hasUnsavedChanges: false,
          lastSaved: new Date()
        });
      },

      setCurrentWorkflow: (workflow: Workflow | null) => {
        set({
          currentWorkflow: workflow,
          currentWorkflowId: workflow?.id || null,
          workflowName: workflow?.name || 'New Workflow'
        });
      },

      markUnsavedChanges: () => {
        set({ hasUnsavedChanges: true });
      },

      clearUnsavedChanges: () => {
        set({ hasUnsavedChanges: false, lastSaved: new Date() });
      }
    })),
    { name: 'flow-store' }
  )
);
