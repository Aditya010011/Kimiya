import React, { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '../../stores/flowStore';
import { registerCoreComponents } from './components/nodes';
import componentRegistry from '../../lib/componentRegistry';

import NewSidebar from './NewSidebar';
import NewFlowCanvas from './NewFlowCanvas';
import ConfigPanel from './ConfigPanel';
import FlowToolbar from './FlowToolbar';

const NewFlowEditorContent: React.FC = () => {
  const {
    registerComponent,
    isConfigPanelOpen,
    selectedNodeId,
    initializeFromStorage
  } = useFlowStore();

  // Register all core components on mount, then initialize from storage
  useEffect(() => {
    console.log('🔧 NewFlowEditor: Starting initialization...');

    // Step 1: Register components
    registerCoreComponents(componentRegistry);
    componentRegistry.getAll().forEach(definition => {
      registerComponent(definition);
    });
    console.log('📦 NewFlowEditor: Components registered');

    // Step 2: Check if there's a saved workflow
    const savedWorkflow = localStorage.getItem('langflow_workflow');
    if (savedWorkflow) {
      console.log('📂 NewFlowEditor: Found saved workflow, attempting to load...');
      try {
        const workflowData = JSON.parse(savedWorkflow);
        console.log('📊 NewFlowEditor: Workflow data:', {
          name: workflowData.name,
          nodes: workflowData.nodes?.length || 0,
          edges: workflowData.edges?.length || 0
        });

        // Step 3: Initialize from storage
        initializeFromStorage();
      } catch (error) {
        console.error('❌ NewFlowEditor: Error parsing saved workflow:', error);
      }
    } else {
      console.log('📭 NewFlowEditor: No saved workflow found');
    }
  }, []); // Remove dependencies to prevent re-running

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
