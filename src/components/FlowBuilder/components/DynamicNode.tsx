import React from 'react';
import { NodeProps } from '@xyflow/react';
import { useFlowStore } from '../../../stores/flowStore';
import BaseNode from './BaseNode';

const DynamicNode: React.FC<NodeProps> = (props) => {
  const { getComponent, deleteNode } = useFlowStore();

  // Get component definition from registry
  const componentDef = getComponent(props.type);

  if (!componentDef) {
    const handleDelete = () => {
      if (window.confirm(`Delete this unknown component node (${props.type})?`)) {
        deleteNode(props.id);
      }
    };

    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 min-w-[200px] max-w-[250px]">
        <div className="text-red-600 font-semibold mb-2">Unknown Component</div>
        <div className="text-red-500 text-sm mb-3">
          Type: <code className="bg-red-100 px-1 rounded">{props.type}</code>
        </div>
        <div className="text-xs text-red-400 mb-3">
          This component type is not registered. It may have been removed or renamed.
        </div>
        <button
          onClick={handleDelete}
          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded border border-red-300 transition-colors"
        >
          Delete Node
        </button>
      </div>
    );
  }

  // Render the component using its registered React component
  const ComponentRenderer = componentDef.component;
  
  return (
    <BaseNode {...props} definition={componentDef}>
      <ComponentRenderer {...props} definition={componentDef} />
    </BaseNode>
  );
};

export default DynamicNode;
