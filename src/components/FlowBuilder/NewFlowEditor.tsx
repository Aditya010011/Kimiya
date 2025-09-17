import React, { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSearchParams } from 'react-router-dom';

import { useFlowStore } from '../../stores/flowStore';
import { registerCoreComponents } from './components/nodes';
import componentRegistry from '../../lib/componentRegistry';

import NewSidebar from './NewSidebar';
import NewFlowCanvas from './NewFlowCanvas';
import ConfigPanel from './ConfigPanel';
import FlowToolbar from './FlowToolbar';

const NewFlowEditorContent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const {
    registerComponent,
    isConfigPanelOpen,
    selectedNodeId,
    initializeFromStorage,
    loadWorkflow,
    currentWorkflowId
  } = useFlowStore();

  // Register all core components on mount, then load workflow
  useEffect(() => {
    console.log('🔧 NewFlowEditor: Starting initialization...');

    // Step 1: Register components synchronously
    registerCoreComponents(componentRegistry);
    const allComponents = componentRegistry.getAll();
    allComponents.forEach(definition => {
      registerComponent(definition);
    });
    console.log(`📦 NewFlowEditor: ${allComponents.length} components registered`);

    // Step 2: Add a small delay to ensure components are fully registered
    const initializeWorkflow = async () => {
      // Give a small delay to ensure component registration is complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Step 3: Check for workflow ID in URL parameters
      const workflowIdParam = searchParams.get('workflowId');
      if (workflowIdParam) {
        const workflowId = parseInt(workflowIdParam, 10);
        if (!isNaN(workflowId) && workflowId !== currentWorkflowId) {
          console.log(`🔗 NewFlowEditor: Loading workflow from URL parameter: ${workflowId}`);
          try {
            await loadWorkflow(workflowId);
          } catch (error) {
            console.error('❌ NewFlowEditor: Failed to load workflow from URL:', error);
            // Only fallback to localStorage if no current workflow exists
            if (!currentWorkflowId) {
              initializeFromStorage();
            }
          }
          return;
        }
      }

      // Step 4: If no URL parameter and no current workflow, check localStorage as fallback
      if (!currentWorkflowId) {
        const savedWorkflow = localStorage.getItem('langflow_workflow');
        if (savedWorkflow) {
          console.log('📂 NewFlowEditor: Found saved workflow in localStorage, attempting to load...');
          try {
            const workflowData = JSON.parse(savedWorkflow);
            console.log('📊 NewFlowEditor: Workflow data:', {
              name: workflowData.name,
              nodes: workflowData.nodes?.length || 0,
              edges: workflowData.edges?.length || 0
            });

            // Initialize from localStorage as fallback (only if no database workflow)
            initializeFromStorage();
          } catch (error) {
            console.error('❌ NewFlowEditor: Error parsing saved workflow:', error);
          }
        } else {
          console.log('📭 NewFlowEditor: No saved workflow found, starting with empty workflow');
        }
      } else {
        console.log(`📊 NewFlowEditor: Database workflow already loaded (ID: ${currentWorkflowId}), skipping localStorage`);
      }
    };

    initializeWorkflow();
  }, [registerComponent, initializeFromStorage, loadWorkflow, searchParams]);

  return (
    <div className="w-full h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <FlowToolbar />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <NewSidebar />
        
        {/* Canvas */}
        <div className="flex-1 relative">
          <NewFlowCanvas />
        </div>
        
        {/* Configuration Panel */}
        {isConfigPanelOpen && selectedNodeId && (
          <ConfigPanel />
        )}
      </div>
    </div>
  );
};

const NewFlowEditor: React.FC = () => {
  return (
    <ReactFlowProvider>
      <NewFlowEditorContent />
    </ReactFlowProvider>
  );
};

export default NewFlowEditor;
