import React, { useState, useEffect } from 'react';
import { NodeProps } from '@xyflow/react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ComponentDefinition } from '../../../../types/componentTypes';
import { useFlowStore } from '../../../../stores/flowStore';
import { Brain, Database, ChevronDown, X, Settings2 } from 'lucide-react';
import knowledgeBaseService from '@/services/knowledgeBaseService';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  is_active: boolean;
}

interface AINodeComponentProps extends NodeProps {
  definition: ComponentDefinition;
}

const AINodeComponent: React.FC<AINodeComponentProps> = ({
  id,
  data
}) => {
  const { updateNode } = useFlowStore();
  const [prompt, setPrompt] = useState<string>((data.prompt as string) || '');
  const [model, setModel] = useState<string>((data.model as string) || 'gpt-4o');

  // Knowledge Base state
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBase[]>([]);
  const [selectedKBs, setSelectedKBs] = useState<string[]>((data.knowledgeBases as string[]) || []);
  const [kbRetrievalConfig, setKbRetrievalConfig] = useState({
    topK: (data.kbRetrievalConfig as any)?.topK || 3,
    similarityThreshold: (data.kbRetrievalConfig as any)?.similarityThreshold || 0.6,
  });
  const [loadingKBs, setLoadingKBs] = useState(false);
  const [showKBConfig, setShowKBConfig] = useState(false);

  // Load available knowledge bases
  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        setLoadingKBs(true);
        const response = await knowledgeBaseService.list();
        setAvailableKBs(response.knowledgeBases.filter(kb => kb.is_active));
      } catch (error) {
        console.error('Failed to load knowledge bases:', error);
      } finally {
        setLoadingKBs(false);
      }
    };

    loadKnowledgeBases();
  }, []);

  useEffect(() => {
    setPrompt((data.prompt as string) || '');
    setModel((data.model as string) || 'gpt-4o');
    setSelectedKBs((data.knowledgeBases as string[]) || []);
    setKbRetrievalConfig({
      topK: (data.kbRetrievalConfig as any)?.topK || 3,
      similarityThreshold: (data.kbRetrievalConfig as any)?.similarityThreshold || 0.6,
    });
  }, [data.prompt, data.model, data.knowledgeBases, data.kbRetrievalConfig]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);
    updateNode(id, { prompt: value });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    updateNode(id, { model: value });
  };

  const handleKBToggle = (kbId: string) => {
    const newSelectedKBs = selectedKBs.includes(kbId)
      ? selectedKBs.filter(id => id !== kbId)
      : [...selectedKBs, kbId];

    setSelectedKBs(newSelectedKBs);
    updateNode(id, { knowledgeBases: newSelectedKBs });
  };

  const handleRemoveKB = (kbId: string) => {
    const newSelectedKBs = selectedKBs.filter(id => id !== kbId);
    setSelectedKBs(newSelectedKBs);
    updateNode(id, { knowledgeBases: newSelectedKBs });
  };

  const handleConfigChange = (field: string, value: number) => {
    const newConfig = { ...kbRetrievalConfig, [field]: value };
    setKbRetrievalConfig(newConfig);
    updateNode(id, { kbRetrievalConfig: newConfig });
  };

  const modelOptions = [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' }
  ];

  const selectedKBNames = availableKBs
    .filter(kb => selectedKBs.includes(kb.id))
    .map(kb => kb.name);

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`model-${id}`} className="text-sm font-medium">
          AI Model
        </Label>
        <Select value={model} onValueChange={handleModelChange}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select AI model" />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor={`prompt-${id}`} className="text-sm font-medium">
          Conversation Prompt
        </Label>
        <Textarea
          id={`prompt-${id}`}
          value={prompt}
          onChange={handlePromptChange}
          placeholder="Provide detailed instructions guiding agent responses and conversation direction..."
          className="mt-1 min-h-[100px]"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">
          This prompt guides how the AI responds in this conversation node
        </p>
      </div>

      {/* Knowledge Base Selection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-sm font-medium flex items-center gap-1">
            <Database size={14} />
            Knowledge Bases
          </Label>
          {selectedKBs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKBConfig(!showKBConfig)}
              className="h-6 px-2 text-xs"
            >
              <Settings2 size={12} className="mr-1" />
              Config
            </Button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between mt-1 h-auto min-h-[36px] py-2"
              disabled={loadingKBs}
            >
              <div className="flex flex-wrap gap-1 flex-1 text-left">
                {selectedKBs.length === 0 ? (
                  <span className="text-gray-500 text-sm">
                    {loadingKBs ? 'Loading...' : 'Select knowledge bases (optional)'}
                  </span>
                ) : (
                  selectedKBNames.map((name, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveKB(selectedKBs[index]);
                      }}
                    >
                      {name}
                      <X size={12} className="ml-1" />
                    </Badge>
                  ))
                )}
              </div>
              <ChevronDown size={16} className="ml-2 flex-shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <div className="text-sm font-medium mb-2">Select Knowledge Bases</div>
              {availableKBs.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 text-center">
                  No knowledge bases available. Create one first.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableKBs.map((kb) => (
                    <div
                      key={kb.id}
                      className="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleKBToggle(kb.id)}
                    >
                      <Checkbox
                        checked={selectedKBs.includes(kb.id)}
                        onCheckedChange={() => handleKBToggle(kb.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{kb.name}</div>
                        {kb.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {kb.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {kb.document_count} documents
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <p className="text-xs text-gray-500 mt-1">
          AI will retrieve relevant information from selected knowledge bases during conversation
        </p>
      </div>

      {/* KB Retrieval Configuration */}
      {selectedKBs.length > 0 && showKBConfig && (
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
          <div className="text-sm font-medium">Retrieval Settings</div>

          <div>
            <Label htmlFor={`topK-${id}`} className="text-xs">
              Chunks to Retrieve (1-10)
            </Label>
            <Input
              id={`topK-${id}`}
              type="number"
              min={1}
              max={10}
              value={kbRetrievalConfig.topK}
              onChange={(e) => handleConfigChange('topK', parseInt(e.target.value) || 3)}
              className="mt-1 h-8 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of relevant chunks to retrieve per query
            </p>
          </div>

          <div>
            <Label htmlFor={`threshold-${id}`} className="text-xs">
              Similarity Threshold (0-1)
            </Label>
            <Input
              id={`threshold-${id}`}
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={kbRetrievalConfig.similarityThreshold}
              onChange={(e) => handleConfigChange('similarityThreshold', parseFloat(e.target.value) || 0.6)}
              className="mt-1 h-8 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum relevance score (higher = more strict)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Component definition
export const aiNodeDefinition: ComponentDefinition = {
  type: 'conversationNode',
  displayName: 'Conversation Node',
  description: 'AI conversation with configurable prompts and models',
  category: 'AI & ML',
  icon: <Brain size={16} />,
  color: '#8b5cf6', // purple-500
  inputs: [
    {
      name: 'model',
      type: 'select',
      label: 'AI Model',
      description: 'The AI model to use for conversation',
      required: true,
      defaultValue: 'gpt-4o',
      options: [
        { label: 'GPT-4o', value: 'gpt-4o' },
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
        { label: 'Claude 3 Opus', value: 'claude-3-opus' },
        { label: 'Claude 3 Haiku', value: 'claude-3-haiku' }
      ]
    },
    {
      name: 'prompt',
      type: 'textarea',
      label: 'Conversation Prompt',
      description: 'Detailed instructions guiding agent responses and conversation direction',
      required: true,
      validation: {
        max: 4000,
        message: 'Prompt must be less than 4000 characters'
      }
    }
  ],
  outputs: [
    {
      name: 'response',
      type: 'string',
      description: 'The AI conversation response'
    },
    {
      name: 'extractedVariables',
      type: 'object',
      description: 'Variables extracted from the conversation'
    }
  ],
  handles: [
    {
      id: 'input',
      type: 'target',
      position: 'top'
    },
    {
      id: 'output',
      type: 'source',
      position: 'bottom'
    }
  ],
  defaultData: {
    model: 'gpt-4o',
    prompt: 'You are a helpful AI assistant. Be conversational, friendly, and helpful. Guide the conversation naturally based on the user\'s needs.'
  },
  component: AINodeComponent,
  tags: ['ai', 'conversation', 'llm', 'gpt', 'claude', 'chat'],
  documentation: 'Main conversation node for AI-powered real-time voice interactions. Configure the AI model and conversation prompt to guide the agent\'s behavior.'
};

export default AINodeComponent;
