import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Send, Bot, User, Loader2, AlertCircle, Play, Square, Phone, PhoneCall, MessageSquare, Settings, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Node } from '@xyflow/react';
import { ConditionalEdge, ConditionType, ExtractedVariable } from '../../../types/flowTypes';
import { WorkflowConfig } from '../../../types/workflowConfig';
import { toast } from 'sonner';
import { defaultTwilioService, TwilioService, CallResponse } from '../../../services/twilioService';
import { getApiBaseUrl } from '../../../utils/envConfig';
import { chatAnalyticsService } from '../../../services/chatAnalyticsService';
import { useAuthStore } from '../../../stores/authStore';
import { useFlowStore } from '../../../stores/flowStore';
import { useChatWithCredits } from '../../../hooks/useChatWithCredits';

interface PlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: ConditionalEdge[];
  workflowConfig: WorkflowConfig | null;
  globalPrompt: string;
  onUpdateWorkflowConfig?: (config: WorkflowConfig) => void;
  onSaveFlow?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  nodeId?: string;
  nodeName?: string;
  tokenUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// Azure OpenAI config is now handled on the backend

const PlaygroundModal: React.FC<PlaygroundModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  workflowConfig,
  globalPrompt,
  onUpdateWorkflowConfig,
  onSaveFlow
}) => {
  // Get current authenticated user
  const { user } = useAuthStore();

  // Get current workflow name from FlowStore
  const { workflowName: currentWorkflowName } = useFlowStore();

  // Credit-aware chat functionality
  const { sendBasicChatMessage, sendAnalyticsChatMessage } = useChatWithCredits();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [conversationTurns, setConversationTurns] = useState(0);
  const [nodeContext, setNodeContext] = useState<string>('');
  const [conversationSummary, setConversationSummary] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Analytics tracking state
  const [analyticsSessionId, setAnalyticsSessionId] = useState<string | null>(null);
  const [isAnalyticsEnabled, setIsAnalyticsEnabled] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Token usage tracking state
  const [sessionTokenUsage, setSessionTokenUsage] = useState({
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    total_tokens: 0
  });

  // Call functionality state
  const [activeTab, setActiveTab] = useState<'chat' | 'call'>('chat');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  const [twilioService, setTwilioService] = useState<TwilioService>(defaultTwilioService);

  // Twilio configuration editing state
  const [isEditingTwilio, setIsEditingTwilio] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [isLoadingTwilioConfig, setIsLoadingTwilioConfig] = useState(false);
  const [configLoadFailed, setConfigLoadFailed] = useState(false);
  const [twilioConfig, setTwilioConfig] = useState({
    accountSid: workflowConfig?.twilio?.accountSid || '',
    authToken: workflowConfig?.twilio?.authToken || '',
    phoneNumber: workflowConfig?.twilio?.phoneNumber || '',
    recordCalls: workflowConfig?.twilio?.recordCalls ?? true,
    callTimeout: workflowConfig?.twilio?.callTimeout ?? 30
  });
  const [showAuthToken, setShowAuthToken] = useState(false);

  // Workflow execution state - track extracted variables
  const [extractedVariables, setExtractedVariables] = useState<Map<string, any>>(new Map());

  // User inactivity tracking for follow-up messages
  const [lastUserMessageTime, setLastUserMessageTime] = useState<number | null>(null);
  const [inactivityTimeoutId, setInactivityTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Chat now uses backend API instead of direct Azure OpenAI calls

  // Smart auto-scroll: only scroll to bottom if user hasn't manually scrolled up
  useEffect(() => {
    if (scrollAreaRef.current && !isUserScrolling) {
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [messages, isUserScrolling]);

  // Function to scroll to bottom manually
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsUserScrolling(false);
      setShowScrollToBottom(false);
    }
  };

  // Check scroll position to show/hide scroll button
  useEffect(() => {
    if (scrollAreaRef.current) {
      const handleScroll = () => {
        if (scrollAreaRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
          setIsUserScrolling(!isAtBottom);
          setShowScrollToBottom(!isAtBottom);
        }
      };

      scrollAreaRef.current.addEventListener('scroll', handleScroll);
      const currentRef = scrollAreaRef.current;
      return () => currentRef?.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Initialize conversation when modal opens
      initializeConversation();
    } else {
      // Reset state when modal closes
      setMessages([]);
      setInputMessage('');
      setIsLoading(false);
      setIsSimulating(false);
      setCurrentNodeId(null);
      setConversationTurns(0);
      setNodeContext('');
      // Reset call state
      setActiveTab('chat');
      setPhoneNumber('');
      setIsCallInProgress(false);
      setCurrentCallSid(null);
      // Reset Twilio editing state
      setIsEditingTwilio(false);
      setIsSavingTwilio(false);
      setShowAuthToken(false);
      setConfigLoadFailed(false);
    }
  }, [isOpen]);

  // Update Twilio config when workflowConfig changes
  useEffect(() => {
    if (!isEditingTwilio) {
      setTwilioConfig({
        accountSid: workflowConfig?.twilio?.accountSid || '',
        authToken: workflowConfig?.twilio?.authToken || '',
        phoneNumber: workflowConfig?.twilio?.phoneNumber || '',
        recordCalls: workflowConfig?.twilio?.recordCalls ?? true,
        callTimeout: workflowConfig?.twilio?.callTimeout ?? 30
      });
    }
  }, [workflowConfig, isEditingTwilio]);

  // Fetch Twilio config from backend when modal opens
  useEffect(() => {
    console.log('useEffect triggered - isOpen:', isOpen, 'isBackendAvailable:', isBackendAvailable(), 'workflowConfig?.twilio:', !!workflowConfig?.twilio);

    if (isOpen && isBackendAvailable()) {
      console.log('Conditions met, calling fetchTwilioConfigFromBackend');
      fetchTwilioConfigFromBackend();
    } else {
      console.log('Conditions not met for fetching config - isOpen:', isOpen, 'isBackendAvailable:', isBackendAvailable());
    }
  }, [isOpen]);

  const initializeConversation = () => {
    // Find the start node
    const startNode = nodes.find(node => node.type === 'startNode');
    if (startNode) {
      setCurrentNodeId(startNode.id);
      setConversationTurns(0);

      // Set initial context based on start node
      const context = (startNode.data?.prompt || startNode.data?.description || 'Call started') as string;
      setNodeContext(context);

      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `Call simulation started. ${startNode.data?.label || 'Start Node'}: ${context}`,
        timestamp: new Date(),
        nodeId: startNode.id,
        nodeName: startNode.data?.label as string
      };
      setMessages([systemMessage]);

      // ALWAYS have AI initiate the conversation (simulating outbound call)
      setTimeout(() => {
        initiateNodeConversation(startNode, true); // true = this is the first node
      }, 500);
    } else {
      toast.error('No start node found in the workflow');
    }
  };

  // Start analytics session
  const startAnalyticsSession = async () => {
    if (!isAnalyticsEnabled) {
      console.log('⚠️ ANALYTICS: Skipping session start - analytics disabled');
      return;
    }

    // Create a default workflow config if none exists
    const effectiveWorkflowConfig = workflowConfig || {
      id: `workflow-${Date.now()}`,
      name: currentWorkflowName || 'Untitled Workflow',
      description: 'Auto-generated workflow for playground session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('🚀 ANALYTICS: Starting session with config:', effectiveWorkflowConfig.name);
    console.log('📝 ANALYTICS: Using workflow name from FlowStore:', currentWorkflowName);
    console.log('📝 ANALYTICS: workflowConfig exists:', !!workflowConfig);

    try {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const startTime = new Date();

      console.log('🚀 ANALYTICS: Starting new session:', {
        sessionId,
        workflowId: effectiveWorkflowConfig.id,
        workflowName: effectiveWorkflowConfig.name,
        userId: user?.id || 1,
        userEmail: user?.email || 'development-user'
      });

      await chatAnalyticsService.createChatSession({
        session_id: sessionId,
        workflow_id: effectiveWorkflowConfig.id,
        workflow_name: effectiveWorkflowConfig.name,
        user_id: user?.id || 1, // Use authenticated user ID, fallback to 1 for development
        start_time: startTime.toISOString()
      });

      setAnalyticsSessionId(sessionId);
      setSessionStartTime(startTime);
      console.log('✅ ANALYTICS: Session started successfully:', sessionId);
    } catch (error) {
      console.error('❌ ANALYTICS: Failed to start session:', error);
      // Don't show error to user, just log it
    }
  };

  // End analytics session
  const endAnalyticsSession = async (outcome?: string) => {
    if (!analyticsSessionId || !isAnalyticsEnabled) {
      console.log('⚠️ ANALYTICS: Skipping session end - no active session or analytics disabled');
      return;
    }

    try {
      console.log('🏁 ANALYTICS: Ending session:', analyticsSessionId, 'with outcome:', outcome || 'success');

      await chatAnalyticsService.updateChatSession(analyticsSessionId, {
        end_time: new Date().toISOString(),
        status: 'completed',
        outcome: (outcome as 'success' | 'partial_success' | 'failure' | 'abandoned') || 'success'
      });

      console.log('✅ ANALYTICS: Session ended successfully:', analyticsSessionId);
      setAnalyticsSessionId(null);
      setSessionStartTime(null);
    } catch (error) {
      console.error('❌ ANALYTICS: Failed to end session:', error);
    }
  };

  const callBackendChatAPI = async (messages: any[]): Promise<{ content: string; tokenUsage: any }> => {
    try {
      // Get current node to check for KB configuration
      const currentNode = currentNodeId ? nodes.find(n => n.id === currentNodeId) : null;

      const requestBody: any = {
        messages: messages,
        workflowId: workflowConfig?.id || `workflow-${Date.now()}`,
        globalPrompt: globalPrompt,
        currentNodeId: currentNodeId
      };

      // Add knowledge base configuration if present in current node
      if (currentNode?.data?.knowledgeBases && Array.isArray(currentNode.data.knowledgeBases) && currentNode.data.knowledgeBases.length > 0) {
        requestBody.knowledgeBases = currentNode.data.knowledgeBases;
        requestBody.kbRetrievalConfig = currentNode.data.kbRetrievalConfig || {
          topK: 3,
          similarityThreshold: 0.6
        };
        console.log('📚 KB: Including knowledge bases in chat request:', requestBody.knowledgeBases);
      }

      // Add analytics-specific fields if analytics is enabled
      if (isAnalyticsEnabled) {
        // Create effective workflow config for analytics
        const effectiveWorkflowConfig = workflowConfig || {
          id: `workflow-${Date.now()}`,
          name: currentWorkflowName || 'Untitled Workflow',
          description: 'Auto-generated workflow for playground session'
        };

        requestBody.sessionId = analyticsSessionId;
        requestBody.userId = user?.id || 1; // Use authenticated user ID, fallback to 1 for development
        requestBody.workflowName = effectiveWorkflowConfig.name;
        requestBody.isNewSession = !analyticsSessionId; // First message creates session
        requestBody.isEndSession = false; // Will be set to true on termination
      }

      console.log('🔄 CHAT API: Calling with analytics:', isAnalyticsEnabled);

      // Use credit-aware chat functionality
      const chatFunction = isAnalyticsEnabled ? sendAnalyticsChatMessage : sendBasicChatMessage;
      const response = await chatFunction(requestBody, {
        includeAuth: true,
        onCreditDeducted: (creditsDeducted, remainingBalance) => {
          console.log(`💳 Credits deducted: ${creditsDeducted}, remaining: ${remainingBalance}`);
        },
        onInsufficientCredits: (currentBalance, requiredCredits) => {
          console.warn(`⚠️ Insufficient credits: ${currentBalance}/${requiredCredits}`);
        }
      });

      if (!response.success) {
        // Check if this is a credit-related error (already handled by useChatWithCredits)
        const isCreditError = response.error?.toLowerCase().includes('insufficient credits') ||
                             response.error?.toLowerCase().includes('credit');

        const error: any = new Error(response.error || 'Chat request failed');
        error.isCreditError = isCreditError;
        throw error;
      }

      // Return both response and token usage
      return {
        content: response.response || 'No response generated',
        tokenUsage: response.tokenUsage || response.usage || null
      };
    } catch (error: any) {
      console.error('Backend chat API error:', error);
      // Mark credit errors so they can be handled differently
      if (error.message?.toLowerCase().includes('insufficient credits') ||
          error.message?.toLowerCase().includes('credit')) {
        error.isCreditError = true;
      }
      throw error;
    }
  };

  const getEffectiveGlobalPrompt = () => {
    // First try to get global prompt from start node, then fall back to passed globalPrompt
    const startNode = nodes.find(node => node.type === 'startNode');
    return startNode?.data?.globalPrompt || globalPrompt || 'You are a helpful AI assistant.';
  };

  const initiateNodeConversation = async (node: Node, isFirstNode: boolean = false) => {
    if (node.type === 'conversationNode' || node.type === 'startNode') {
      const nodePrompt = node.data?.prompt || node.data?.greeting || '';
      const nodeInstructions = node.data?.instructions || '';
      const effectiveGlobalPrompt = getEffectiveGlobalPrompt();

      // Get conversation history for context
      const conversationHistory = messages
        .filter(msg => msg.role !== 'system')
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const systemPrompt = `${effectiveGlobalPrompt}

Current Node: ${node.data?.label || node.type}
Node Context: ${nodePrompt}
${nodeInstructions ? `Instructions: ${nodeInstructions}` : ''}
${conversationSummary ? `\nConversation Summary So Far: ${conversationSummary}` : ''}

${isFirstNode
  ? 'You are initiating an outbound phone call. Start the conversation naturally based on the node context. Be friendly and professional.'
  : 'You have just transitioned to a new node in the conversation. Continue the conversation naturally, focusing on this node\'s specific objective. Do NOT repeat greetings or information already discussed.'
}

IMPORTANT:
- Ask questions to gather information needed to satisfy the edge conditions for moving to the next node
- If the user's response is unclear or ambiguous, ask clarifying questions
- Stay in this node until you have clear, definitive information to satisfy an edge condition
- Focus ONLY on this node's objective - don't try to complete the entire workflow here`;

      try {
        const result = await callBackendChatAPI([
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: isFirstNode ? '[CALL_START]' : '[NODE_TRANSITION]' }
        ]);

        // Update session token usage
        if (result.tokenUsage) {
          setSessionTokenUsage(prev => ({
            total_prompt_tokens: prev.total_prompt_tokens + (result.tokenUsage.prompt_tokens || 0),
            total_completion_tokens: prev.total_completion_tokens + (result.tokenUsage.completion_tokens || 0),
            total_tokens: prev.total_tokens + (result.tokenUsage.total_tokens || 0)
          }));
        }

        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          nodeId: node.id,
          tokenUsage: result.tokenUsage,
          nodeName: node.data?.label as string
        };

        setMessages(prev => [...prev, aiMessage]);

        // Start inactivity timer after AI sends a message
        startInactivityTimer();
      } catch (error) {
        console.error('Failed to initiate conversation:', error);
      }
    }
  };

  /**
   * Send a follow-up message if user hasn't responded in 20 seconds
   */
  const sendFollowUpMessage = async () => {
    const currentNode = getCurrentNode();
    if (!currentNode || !isSimulating || isLoading) return;

    console.log('[Playground] User inactive for 20 seconds - sending follow-up');

    const nodePrompt = currentNode.data?.prompt || '';
    const effectiveGlobalPrompt = getEffectiveGlobalPrompt();

    const conversationHistory = messages
      .filter(msg => msg.role !== 'system')
      .slice(-10)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    const systemPrompt = `${effectiveGlobalPrompt}

Current Node: ${currentNode.data?.label || currentNode.type}
Node Context: ${nodePrompt}

The user hasn't responded for a few seconds. Send a brief, natural follow-up message to re-engage them.
Examples: "Are you still there?", "Did you have any questions?", "Would you like me to clarify anything?"

Keep it short, friendly, and contextually relevant to what you just asked.`;

    try {
      setIsLoading(true);
      const result = await callBackendChatAPI([
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: '[USER_INACTIVE]' }
      ]);

      // Update session token usage
      if (result.tokenUsage) {
        setSessionTokenUsage(prev => ({
          total_prompt_tokens: prev.total_prompt_tokens + (result.tokenUsage.prompt_tokens || 0),
          total_completion_tokens: prev.total_completion_tokens + (result.tokenUsage.completion_tokens || 0),
          total_tokens: prev.total_tokens + (result.tokenUsage.total_tokens || 0)
        }));
      }

      const aiMessage: ChatMessage = {
        id: `ai-followup-${Date.now()}`,
        role: 'assistant',
        content: result.content,
        timestamp: new Date(),
        nodeId: currentNode.id,
        tokenUsage: result.tokenUsage,
        nodeName: currentNode.data?.label as string
      };

      setMessages(prev => [...prev, aiMessage]);

      // Restart inactivity timer after follow-up
      startInactivityTimer();
    } catch (error) {
      console.error('Failed to send follow-up message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start or restart the inactivity timer
   */
  const startInactivityTimer = () => {
    // Clear existing timer
    if (inactivityTimeoutId) {
      clearTimeout(inactivityTimeoutId);
    }

    // Set new timer for 20 seconds
    const timeoutId = setTimeout(() => {
      sendFollowUpMessage();
    }, 20000);

    setInactivityTimeoutId(timeoutId);
    setLastUserMessageTime(Date.now());
  };

  /**
   * Clear the inactivity timer
   */
  const clearInactivityTimer = () => {
    if (inactivityTimeoutId) {
      clearTimeout(inactivityTimeoutId);
      setInactivityTimeoutId(null);
    }
  };

  // Clean up timer on unmount or when simulation stops
  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, []);

  useEffect(() => {
    if (!isSimulating) {
      clearInactivityTimer();
    }
  }, [isSimulating]);

  const getCurrentNode = () => {
    return nodes.find(node => node.id === currentNodeId);
  };

  /**
   * Evaluate if an edge condition is met
   */
  const evaluateEdgeCondition = async (edge: ConditionalEdge, userMessage: string, aiResponse: string): Promise<boolean> => {
    // No condition or NONE type = always follow
    if (!edge.data || edge.data.type === ConditionType.NONE) {
      return true;
    }

    const conditionData = edge.data;

    try {
      // Check for simple keyword matching first (faster than AI)
      // If aiCondition looks like a simple keyword (single word, no spaces or punctuation), treat it as keyword match
      if (conditionData.type === ConditionType.AI_BASED && conditionData.aiCondition) {
        const condition = conditionData.aiCondition.trim().toLowerCase();
        const userLower = userMessage.toLowerCase();
        const aiLower = aiResponse.toLowerCase();

        // Simple keyword matching for common cases like "yes", "no", "help", etc.
        const isSimpleKeyword = /^[a-z]+$/.test(condition) && condition.length < 15;

        if (isSimpleKeyword) {
          // Check if keyword appears in user message or AI response
          const keywordFound = userLower.includes(condition) || aiLower.includes(condition);
          console.log(`[Playground] Keyword match for "${condition}": ${keywordFound}`);
          return keywordFound;
        }
      }

      // AI-based condition evaluation (for complex conditions)
      if (conditionData.type === ConditionType.AI_BASED && conditionData.aiCondition) {
        console.log(`[Playground] Evaluating AI condition: "${conditionData.aiCondition}"`);

        // Use AI to evaluate the condition
        const evaluationPrompt = `You are evaluating a workflow condition.

Condition to evaluate: "${conditionData.aiCondition}"

Recent conversation context:
User: ${userMessage}
Assistant: ${aiResponse}

Does the conversation satisfy this condition? Consider the user's intent, the content of the messages, and the context.

Respond with ONLY "YES" if the condition is met, or "NO" if it is not met.`;

        const result = await callBackendChatAPI([
          { role: 'system', content: evaluationPrompt }
        ]);

        const conditionMet = result.content.trim().toUpperCase().includes('YES');
        console.log(`[Playground] AI condition result: ${conditionMet}`);
        return conditionMet;
      }

      // Logical condition evaluation
      if (conditionData.type === ConditionType.LOGICAL && conditionData.logicalConditions) {
        console.log(`[Playground] Evaluating ${conditionData.logicalConditions.length} logical conditions`);

        let result = true;
        for (const condition of conditionData.logicalConditions) {
          const variableValue = extractedVariables.get(condition.variable);
          const conditionResult = evaluateLogicalCondition(condition, variableValue);

          console.log(`[Playground] Logical condition: ${condition.variable} ${condition.operator} ${condition.value} = ${conditionResult}`);

          // Handle AND/OR combination
          if (condition.combineWith === 'and') {
            result = result && conditionResult;
          } else if (condition.combineWith === 'or') {
            result = result || conditionResult;
          } else {
            result = conditionResult;
          }
        }

        console.log(`[Playground] Logical conditions result: ${result}`);
        return result;
      }

      // Combined condition (AI + Logical)
      if (conditionData.type === ConditionType.COMBINED) {
        console.log(`[Playground] Evaluating combined condition`);

        // Evaluate both AI and logical conditions
        let aiResult = true;
        let logicalResult = true;

        if (conditionData.aiCondition) {
          aiResult = await evaluateEdgeCondition(
            { ...edge, data: { ...conditionData, type: ConditionType.AI_BASED } },
            userMessage,
            aiResponse
          );
        }

        if (conditionData.logicalConditions) {
          logicalResult = await evaluateEdgeCondition(
            { ...edge, data: { ...conditionData, type: ConditionType.LOGICAL } },
            userMessage,
            aiResponse
          );
        }

        const result = aiResult && logicalResult;
        console.log(`[Playground] Combined condition result: ${result} (AI: ${aiResult}, Logical: ${logicalResult})`);
        return result;
      }

      // Default: condition not recognized
      console.warn(`[Playground] Unknown condition type: ${conditionData.type}`);
      return false;

    } catch (error) {
      console.error('[Playground] Error evaluating edge condition:', error);
      return false;
    }
  };

  /**
   * Evaluate a single logical condition
   */
  const evaluateLogicalCondition = (condition: any, variableValue: any): boolean => {
    if (variableValue === undefined || variableValue === null) {
      console.warn(`[Playground] Variable "${condition.variable}" not found in extracted variables`);
      return false;
    }

    const { operator, value } = condition;

    switch (operator) {
      case '==':
      case 'equals':
        return variableValue == value;

      case '!=':
      case 'not_equals':
        return variableValue != value;

      case '>':
      case 'greater_than':
        return Number(variableValue) > Number(value);

      case '<':
      case 'less_than':
        return Number(variableValue) < Number(value);

      case '>=':
      case 'greater_than_or_equal':
        return Number(variableValue) >= Number(value);

      case '<=':
      case 'less_than_or_equal':
        return Number(variableValue) <= Number(value);

      case 'contains':
        return String(variableValue).toLowerCase().includes(String(value).toLowerCase());

      case 'not_contains':
        return !String(variableValue).toLowerCase().includes(String(value).toLowerCase());

      default:
        console.warn(`[Playground] Unknown operator: ${operator}`);
        return false;
    }
  };

  /**
   * Extract variables from conversation using AI
   */
  const extractVariablesFromConversation = async (userMessage: string, aiResponse: string, currentNode: Node) => {
    // Get variables that should be extracted from this node
    const { workflowContext } = useFlowStore.getState();
    const nodeVariables = Array.from(workflowContext.variables.values()).filter(
      v => v.nodeId === currentNode.id
    );

    if (nodeVariables.length === 0) {
      return; // No variables to extract for this node
    }

    console.log(`[Playground] Extracting ${nodeVariables.length} variables from conversation`);

    try {
      const extractionPrompt = `You are extracting specific information from a conversation.

Variables to extract:
${nodeVariables.map(v => `- ${v.name} (${v.type}): ${v.description}`).join('\n')}

Recent conversation:
User: ${userMessage}
Assistant: ${aiResponse}

Extract the values for each variable from the conversation. If a variable's value is not mentioned, respond with "NOT_FOUND".

Respond in JSON format:
{
  "variable_name": "extracted_value",
  ...
}`;

      const result = await callBackendChatAPI([
        { role: 'system', content: extractionPrompt }
      ]);

      // Parse the JSON response
      try {
        const extractedData = JSON.parse(result.content);

        // Update extracted variables state
        setExtractedVariables(prev => {
          const updated = new Map(prev);
          for (const [key, value] of Object.entries(extractedData)) {
            if (value !== 'NOT_FOUND') {
              updated.set(key, value);
              console.log(`[Playground] Extracted variable: ${key} = ${value}`);
            }
          }
          return updated;
        });
      } catch (parseError) {
        console.warn('[Playground] Failed to parse variable extraction response:', result.content);
      }
    } catch (error) {
      console.error('[Playground] Error extracting variables:', error);
    }
  };

  /**
   * Get the next node based on edge conditions
   */
  const getNextNode = async (currentNodeId: string, userMessage: string, aiResponse: string): Promise<Node | null> => {
    // Find edges from current node
    const outgoingEdges = edges.filter(edge => edge.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      console.log('[Playground] No outgoing edges - end of workflow');
      return null; // End of flow
    }

    // If only one edge, follow it (no need to evaluate conditions)
    if (outgoingEdges.length === 1) {
      console.log('[Playground] Single edge - following it');
      return nodes.find(node => node.id === outgoingEdges[0].target) || null;
    }

    // Multiple edges - evaluate conditions
    console.log(`[Playground] Evaluating ${outgoingEdges.length} edges for conditions`);

    for (const edge of outgoingEdges) {
      // Skip default edges in first pass
      if (edge.data?.isDefault) {
        continue;
      }

      const conditionMet = await evaluateEdgeCondition(edge, userMessage, aiResponse);

      if (conditionMet) {
        console.log(`[Playground] Condition met for edge ${edge.id} - following to node ${edge.target}`);
        return nodes.find(node => node.id === edge.target) || null;
      }
    }

    // No conditions matched - look for default edge
    const defaultEdge = outgoingEdges.find(e => e.data?.isDefault);
    if (defaultEdge) {
      console.log('[Playground] No conditions matched - following default edge');
      return nodes.find(node => node.id === defaultEdge.target) || null;
    }

    // No matching conditions and no default edge - stay in current node
    console.log('[Playground] No conditions matched and no default edge - staying in current node');
    return null;
  };

  const getNodeTypeDescription = (nodeType: string) => {
    switch (nodeType) {
      case 'startNode':
        return 'Call Start';
      case 'conversationNode':
        return 'AI Conversation';
      case 'apiRequest':
        return 'API Request';
      case 'transferCall':
        return 'Transfer Call';
      case 'toolNode':
        return 'Tool Execution';
      case 'endCall':
        return 'Call End';
      default:
        return nodeType;
    }
  };

  const shouldMoveToNextNode = async (currentNode: Node, conversationHistory: ChatMessage[], userMessage: string): Promise<boolean> => {
    // For non-conversation nodes, move immediately
    if (currentNode.type !== 'conversationNode' && currentNode.type !== 'startNode') {
      return true;
    }

    // For conversation nodes, use AI to determine if we should move on
    const nodeObjective = currentNode.data?.prompt || currentNode.data?.objective || '';
    const nodeInstructions = currentNode.data?.instructions || '';

    const evaluationPrompt = `You are evaluating whether a conversation has completed its objective for the current node.

Current Node: ${currentNode.data?.label || currentNode.type}
Node Objective: ${nodeObjective}
${nodeInstructions ? `Instructions: ${nodeInstructions}` : ''}

Recent conversation:
${conversationHistory.slice(-8).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Latest user message: ${userMessage}

Has this conversation node achieved its objective? Should we move to the next step in the workflow?

IMPORTANT CRITERIA FOR MOVING TO NEXT NODE:
- Has this specific node's LIMITED objective been fulfilled? (Don't try to do everything in one node)
- For "Welcome & Greeting": Has the user been welcomed and expressed their basic intent?
- For "Inquiry Type Classification": Has the inquiry type been identified?
- For "Requirements Gathering": Has basic requirement info been collected?
- Each node should have a FOCUSED, LIMITED purpose

MOVE TO NEXT NODE if:
- The current node's specific objective is reasonably complete
- The user has provided the basic information this node is designed to collect
- The conversation has addressed this node's core purpose
- There are other specialized nodes designed for additional details

AVOID staying in current node if:
- You're trying to gather information that belongs in a different node
- The conversation is going beyond this node's specific scope
- You're asking for details that other nodes are designed to handle

Respond with only "YES" if we should move to the next node, or "NO" if we should continue the conversation in this node.`;

    try {
      const result = await callBackendChatAPI([
        { role: 'system', content: evaluationPrompt }
      ]);

      // Update session token usage
      if (result.tokenUsage) {
        setSessionTokenUsage(prev => ({
          total_prompt_tokens: prev.total_prompt_tokens + (result.tokenUsage.prompt_tokens || 0),
          total_completion_tokens: prev.total_completion_tokens + (result.tokenUsage.completion_tokens || 0),
          total_tokens: prev.total_tokens + (result.tokenUsage.total_tokens || 0)
        }));
      }

      return result.content.trim().toUpperCase().includes('YES');
    } catch (error) {
      console.error('Failed to evaluate node completion:', error);
      // Default to staying in node if evaluation fails
      return false;
    }
  };

  const simulateWorkflowStep = async (userMessage: string) => {
    const currentNode = getCurrentNode();
    if (!currentNode) return;

    setConversationTurns(prev => prev + 1);

    // Handle different node types
    if (currentNode.type === 'conversationNode' || currentNode.type === 'startNode') {
      // AI Conversation Node - have a natural conversation
      const nodePrompt = currentNode.data?.prompt || '';
      const nodeInstructions = currentNode.data?.instructions || '';

      const effectiveGlobalPrompt = getEffectiveGlobalPrompt();

      // Get conversation history excluding system messages but including context
      const conversationHistory = messages
        .filter(msg => msg.role !== 'system')
        .slice(-10) // Keep last 10 messages for context
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const conversationMessages = [
        {
          role: 'system',
          content: `${effectiveGlobalPrompt}

Current Node: ${currentNode.data?.label || currentNode.type}
Node Context: ${nodePrompt}
${nodeInstructions ? `Instructions: ${nodeInstructions}` : ''}
${conversationSummary ? `\nConversation Summary So Far: ${conversationSummary}` : ''}

You are continuing a phone conversation. The user has been talking with you and you should maintain context from the previous conversation.

CRITICAL INSTRUCTIONS FOR THIS NODE:
- Your PRIMARY GOAL is to gather clear, definitive information to satisfy the edge conditions for moving to the next node
- If the user's response is unclear, ambiguous, or incomplete, you MUST ask clarifying questions
- Do NOT move forward until you have a clear, definitive answer
- Ask follow-up questions naturally to get the information you need
- Stay in this node until the edge condition is clearly satisfied

CONVERSATION GUIDELINES:
- Do NOT start with greetings like "Hello" or "Thank you for reaching out" unless this is truly the first interaction
- Continue the conversation naturally based on what has been discussed
- Remember what the user has already told you (check the conversation summary)
- Don't ask for information the user has already provided
- Focus ONLY on this node's specific objective - there are other nodes designed for other purposes
- Be conversational and natural, not robotic or repetitive

EXAMPLES OF GOOD CLARIFYING QUESTIONS:
- User says "Maybe" → Ask: "Can you tell me more about your situation? Are you currently looking to sell or just exploring options?"
- User says "I'm not sure" → Ask: "No problem! What brings you here today? Are you interested in buying or selling property?"
- User gives vague answer → Ask specific follow-up questions to get clarity

Conversation turns in this node: ${conversationTurns}`
        },
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage
        }
      ];

      try {
        const result = await callBackendChatAPI(conversationMessages);

        // Update session token usage
        if (result.tokenUsage) {
          setSessionTokenUsage(prev => ({
            total_prompt_tokens: prev.total_prompt_tokens + (result.tokenUsage.prompt_tokens || 0),
            total_completion_tokens: prev.total_completion_tokens + (result.tokenUsage.completion_tokens || 0),
            total_tokens: prev.total_tokens + (result.tokenUsage.total_tokens || 0)
          }));
        }

        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          nodeId: currentNode.id,
          nodeName: currentNode.data?.label as string,
          tokenUsage: result.tokenUsage
        };

        setMessages(prev => [...prev, aiMessage]);

        // Note: AI message analytics tracking is handled by the backend chat-with-analytics endpoint
        // to avoid duplicate message storage

        // Extract variables from the conversation
        await extractVariablesFromConversation(userMessage, result.content, currentNode);

        // Check edge conditions in the background to see if we should transition
        // But DON'T transition immediately - let AI ask clarifying questions first
        await evaluateAndTransitionIfReady(currentNode.id, userMessage, result.content);

        // Start inactivity timer after AI responds
        startInactivityTimer();
      } catch (error: any) {
        // Don't show generic error toast if this is a credit error
        // (credit errors are already handled by useChatWithCredits hook)
        if (!error.isCreditError) {
          toast.error('Failed to get AI response');
        }
        console.error('AI response error:', error);
        return;
      }
    } else {
      // Non-conversation nodes - process and move immediately
      const nodeResponse = await handleNonConversationNode(currentNode);
      await moveToNextNode(currentNode.id, userMessage, nodeResponse);
    }
  };

  const handleNonConversationNode = async (node: Node): Promise<string> => {
    let nodeMessage: ChatMessage;
    let responseContent: string;

    if (node.type === 'apiRequest') {
      responseContent = `[API Request] ${node.data?.label || 'API call executed'} - Processing request...`;
      nodeMessage = {
        id: `api-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        nodeId: node.id,
        nodeName: node.data?.label as string
      };
    } else if (node.type === 'endCall') {
      responseContent = 'Call ended. Thank you for calling!';
      nodeMessage = {
        id: `end-${Date.now()}`,
        role: 'system',
        content: responseContent,
        timestamp: new Date(),
        nodeId: node.id,
        nodeName: node.data?.label as string
      };
      setIsSimulating(false);
    } else {
      responseContent = `[${getNodeTypeDescription(node.type)}] ${node.data?.label || 'Processing'}...`;
      nodeMessage = {
        id: `node-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        nodeId: node.id,
        nodeName: node.data?.label as string
      };
    }

    setMessages(prev => [...prev, nodeMessage]);
    return responseContent;
  };

  /**
   * Evaluate edge conditions and transition ONLY if condition is definitively met
   * This replaces the old immediate transition logic
   */
  const evaluateAndTransitionIfReady = async (currentNodeId: string, userMessage: string, aiResponse: string) => {
    console.log('[Playground] Evaluating edge conditions for potential transition...');

    const outgoingEdges = edges.filter(edge => edge.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      console.log('[Playground] No outgoing edges - end of workflow');
      return;
    }

    // Evaluate all edge conditions
    for (const edge of outgoingEdges) {
      // Skip default edges in first pass
      if (edge.data?.isDefault) {
        continue;
      }

      const conditionMet = await evaluateEdgeCondition(edge, userMessage, aiResponse);

      if (conditionMet) {
        console.log(`[Playground] ✅ Edge condition DEFINITIVELY met for edge ${edge.id}`);
        console.log(`[Playground] Transitioning to node ${edge.target}`);

        // Condition is definitively met - transition now
        const nextNode = nodes.find(node => node.id === edge.target);
        if (nextNode) {
          await transitionToNode(nextNode);
        }
        return;
      } else {
        console.log(`[Playground] ❌ Edge condition NOT met for edge ${edge.id} - AI should ask clarifying questions`);
      }
    }

    // No conditions met - check for default edge
    const defaultEdge = outgoingEdges.find(e => e.data?.isDefault);
    if (defaultEdge) {
      console.log('[Playground] No conditions met - but NOT transitioning to default edge yet');
      console.log('[Playground] AI should continue asking questions to satisfy a condition');
    } else {
      console.log('[Playground] No conditions met and no default edge - staying in current node');
    }
  };

  /**
   * Actually transition to a new node
   */
  const transitionToNode = async (nextNode: Node) => {
    console.log(`[Playground] 🔄 Transitioning to node: ${nextNode.data?.label || nextNode.type}`);

    setCurrentNodeId(nextNode.id);
    setConversationTurns(0); // Reset conversation turns for new node

    // Set new node context
    const context = (nextNode.data?.prompt || nextNode.data?.description || '') as string;
    setNodeContext(context);

    // Add system message about node transition
    const transitionMessage: ChatMessage = {
      id: `transition-${Date.now()}`,
      role: 'system',
      content: `→ Moved to: ${nextNode.data?.label || getNodeTypeDescription(nextNode.type)}`,
      timestamp: new Date(),
      nodeId: nextNode.id,
      nodeName: nextNode.data?.label as string
    };

    setMessages(prev => [...prev, transitionMessage]);

    // Initiate conversation in the new node
    await initiateNodeConversation(nextNode, false);
  };

  const moveToNextNode = async (currentNodeId: string, userMessage: string, aiResponse: string) => {
    const nextNode = await getNextNode(currentNodeId, userMessage, aiResponse);

    if (nextNode) {
      await transitionToNode(nextNode);
    } else {
      // End of workflow
      const endMessage: ChatMessage = {
        id: `end-${Date.now()}`,
        role: 'system',
        content: 'Workflow completed successfully.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, endMessage]);
      setIsSimulating(false);
    }
  };

  // Function to detect if user wants to end the conversation
  const detectTerminationIntent = (message: string): boolean => {
    const terminationKeywords = [
      'bye', 'goodbye', 'good bye', 'see you', 'talk later', 'call later',
      'call back', 'that\'s all', 'thanks bye', 'thank you bye', 'gotta go',
      'have to go', 'need to go', 'end call', 'hang up', 'disconnect',
      'that\'s it', 'i\'m done', 'we\'re done', 'all set', 'thank you that\'s all'
    ];

    const messageLower = message.toLowerCase().trim();
    return terminationKeywords.some(keyword => messageLower.includes(keyword));
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Clear inactivity timer when user sends a message
    clearInactivityTimer();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Note: User message analytics tracking is handled by the backend chat-with-analytics endpoint
    // to avoid duplicate message storage

    // Check for termination intent
    if (detectTerminationIntent(messageContent)) {
      const goodbyeMessage: ChatMessage = {
        id: `goodbye-${Date.now()}`,
        role: 'assistant',
        content: 'Thank you so much for our conversation! It was great talking with you. Have a wonderful day! 👋',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, goodbyeMessage]);

      // End analytics session when conversation ends
      if (analyticsSessionId && isAnalyticsEnabled) {
        try {
          console.log('👋 ANALYTICS: Ending session with success outcome');
          await endAnalyticsSession('success');
        } catch (error) {
          console.error('❌ ANALYTICS: Failed to end session:', error);
        }
      }

      setIsLoading(false);

      // If there's an active call, end it
      if (isCallInProgress && currentCallSid) {
        await handleEndCall();
      }

      return;
    }

    try {
      await simulateWorkflowStep(userMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    setIsSimulating(true);

    // Reset token usage
    setSessionTokenUsage({
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0
    });

    // Reset extracted variables
    setExtractedVariables(new Map());

    // Start analytics session
    await startAnalyticsSession();

    initializeConversation();
  };

  const handleStopSimulation = async () => {
    setIsSimulating(false);
    setMessages([]);
    setCurrentNodeId(null);
    setConversationTurns(0);
    setNodeContext('');
    setConversationSummary('');

    // Reset token usage
    setSessionTokenUsage({
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0
    });

    // Reset extracted variables
    setExtractedVariables(new Map());

    // End analytics session
    await endAnalyticsSession('abandoned');

    // End any active call
    if (isCallInProgress && currentCallSid) {
      await handleEndCall();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if backend API is available for real calls
  const isBackendAvailable = () => {
    if (typeof window === 'undefined') return false;

    // Backend is always available since we're using ubundu deployment
    return true;
  };

  // Fetch Twilio configuration from backend
  const fetchTwilioConfigFromBackend = async () => {
    console.log('fetchTwilioConfigFromBackend called');
    console.log('isBackendAvailable():', isBackendAvailable());

    if (!isBackendAvailable()) {
      console.log('Backend not available, skipping fetch');
      return;
    }

    setIsLoadingTwilioConfig(true);
    try {
      // Use the same API base URL logic as TwilioService
      const API_BASE_URL = getApiBaseUrl();
      console.log('Fetching from:', `${API_BASE_URL}/api/twilio-config`);

      // Check backend health before fetching config
      try {
        console.log('Checking backend health...');
        await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(8000) // 8 second timeout for health check
        });
        console.log('Backend is healthy');
      } catch (healthError) {
        console.warn('Backend health check failed, but continuing:', healthError);
      }

      const response = await fetch(`${API_BASE_URL}/api/twilio-config`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });
      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Received data:', data);

        if (data.success && data.config) {
          // Always use backend config when available (it has the real environment variables)
          console.log('Updating Twilio config with backend data (overriding any workflow config)');
          setTwilioConfig({
            accountSid: data.config.accountSid || '',
            authToken: data.config.authToken || '',
            phoneNumber: data.config.phoneNumber || '',
            recordCalls: data.config.recordCalls ?? true,
            callTimeout: data.config.callTimeout ?? 30
          });
          setConfigLoadFailed(false); // Reset failed state on success
        }
      } else {
        console.error('Failed to fetch config, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch Twilio config from backend:', error);
      // Don't use fallback - let user manually configure
      console.log('Backend config fetch failed - user will need to manually edit config');
      setConfigLoadFailed(true);
    } finally {
      setIsLoadingTwilioConfig(false);
    }
  };

  // Handle Twilio configuration save
  const handleSaveTwilioConfig = async () => {
    if (!onUpdateWorkflowConfig) {
      toast.error('Cannot update configuration - no update handler provided');
      return;
    }

    // Validate required fields
    if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber) {
      toast.error('Please fill in all required Twilio fields');
      return;
    }

    // Validate phone number format
    if (!twilioConfig.phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      toast.error('Phone number must be in E.164 format (e.g., +1234567890)');
      return;
    }

    setIsSavingTwilio(true);

    // Create updated workflow config
    const updatedConfig: WorkflowConfig = {
      ...workflowConfig,
      id: workflowConfig?.id || `workflow-${Date.now()}`,
      name: workflowConfig?.name || 'Untitled Workflow',
      description: workflowConfig?.description || '',
      createdAt: workflowConfig?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      twilio: {
        accountSid: twilioConfig.accountSid,
        authToken: twilioConfig.authToken,
        phoneNumber: twilioConfig.phoneNumber,
        recordCalls: twilioConfig.recordCalls,
        callTimeout: Math.min(Math.max(twilioConfig.callTimeout, 5), 600) // Clamp between 5-600 seconds
      },
      // Preserve other configs or use defaults
      llm: workflowConfig?.llm || {
        provider: 'openai' as any,
        openAI: {
          apiKey: '',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 1000
        }
      },
      voice: workflowConfig?.voice || {
        provider: 'conversation_relay' as any,
        language: 'en-US'
      },
      transcription: workflowConfig?.transcription || {
        provider: 'conversation_relay' as any,
        language: 'en-US'
      },
      globalSettings: workflowConfig?.globalSettings || {
        defaultLanguage: 'en-US',
        timezone: 'UTC',
        callRecording: true,
        transcriptionEnabled: true,
        sentimentAnalysis: false,
        conversationSummary: true,
        maxCallDuration: 30,
        silenceTimeout: 10,
        interruptionHandling: true
      }
    };

    onUpdateWorkflowConfig(updatedConfig);

    // Trigger save to persist changes
    if (onSaveFlow) {
      // Use setTimeout to ensure the state update is processed first
      setTimeout(() => {
        onSaveFlow();
        setIsSavingTwilio(false);
        toast.success('Twilio configuration updated and saved successfully! Changes will persist after refresh.');
      }, 100);
    } else {
      setIsSavingTwilio(false);
      toast.success('Twilio configuration updated successfully!');
    }

    setIsEditingTwilio(false);
  };

  // Handle cancel editing
  const handleCancelTwilioEdit = () => {
    // Reset to original values
    setTwilioConfig({
      accountSid: workflowConfig?.twilio?.accountSid || '',
      authToken: workflowConfig?.twilio?.authToken || '',
      phoneNumber: workflowConfig?.twilio?.phoneNumber || '',
      recordCalls: workflowConfig?.twilio?.recordCalls ?? true,
      callTimeout: workflowConfig?.twilio?.callTimeout ?? 30
    });
    setIsEditingTwilio(false);
    setIsSavingTwilio(false);
  };

  // Call handling functions
  const handleMakeCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    // Basic validation - just check if it contains digits
    if (!phoneNumber.match(/\d/)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsCallInProgress(true);

    try {
      // Use twilioConfig state (which includes backend config) for making calls
      const service = new TwilioService(twilioConfig);
      const fromNumber = twilioConfig.phoneNumber;

      const result: CallResponse = await service.makeOptimizedCall({
        to: phoneNumber,
        from: fromNumber,
        record: twilioConfig.recordCalls,
        timeout: twilioConfig.callTimeout,
        // Include workflow data for dynamic call processing
        workflowId: workflowConfig?.id || `workflow-${Date.now()}`,
        nodes: nodes,
        edges: edges,
        config: workflowConfig,
        globalPrompt: globalPrompt
      });

      if (result.success) {
        setCurrentCallSid(result.callSid || null);
        toast.success(result.message || 'Call initiated successfully');

        // Add a system message about the call
        const callMessage: ChatMessage = {
          id: `call-${Date.now()}`,
          role: 'system',
          content: `📞 Call initiated to ${phoneNumber}${result.callSid ? ` (Call ID: ${result.callSid})` : ''}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, callMessage]);
      } else {
        toast.error(result.error || 'Failed to initiate call');
        setIsCallInProgress(false);
      }
    } catch (error) {
      console.error('Call error:', error);
      toast.error('Failed to initiate call');
      setIsCallInProgress(false);
    }
  };

  const handleEndCall = async () => {
    if (!currentCallSid) {
      setIsCallInProgress(false);
      return;
    }

    try {
      const service = new TwilioService(twilioConfig);
      const result = await service.hangupCall(currentCallSid);

      if (result.success) {
        toast.success('Call ended successfully');
      } else {
        toast.error(result.error || 'Failed to end call');
      }
    } catch (error) {
      console.error('Error ending call:', error);
      toast.error('Failed to end call');
    } finally {
      setIsCallInProgress(false);
      setCurrentCallSid(null);

      // Add a system message about call ending
      const endMessage: ChatMessage = {
        id: `call-end-${Date.now()}`,
        role: 'system',
        content: '📞 Call ended',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, endMessage]);
    }
  };

  const currentNode = getCurrentNode();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>Workflow Playground</span>
            <div className="flex items-center space-x-2">
              {currentNode && (
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {(currentNode.data?.label as string) || getNodeTypeDescription(currentNode.type)}
                  </Badge>
                  {conversationTurns > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Turn {conversationTurns}
                    </Badge>
                  )}
                </div>
              )}
              {!isSimulating ? (
                <Button
                  onClick={handleStartSimulation}
                  size="sm"
                  className="flex items-center space-x-1"
                  disabled={nodes.length === 0}
                >
                  <Play className="h-3 w-3" />
                  <span>Start</span>
                </Button>
              ) : (
                <Button
                  onClick={handleStopSimulation}
                  size="sm"
                  variant="destructive"
                  className="flex items-center space-x-1"
                >
                  <Square className="h-3 w-3" />
                  <span>Stop</span>
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'chat' | 'call')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger value="call" className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span>Call</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-4">
            {/* Token Usage Display */}
            {isSimulating && sessionTokenUsage.total_tokens > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">Session Token Usage</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Prompt:</span>
                      <span className="font-semibold text-blue-600">{sessionTokenUsage.total_prompt_tokens}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Completion:</span>
                      <span className="font-semibold text-purple-600">{sessionTokenUsage.total_completion_tokens}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold text-gray-800">🪙 {sessionTokenUsage.total_tokens}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Variables Display */}
            {isSimulating && extractedVariables.size > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">Extracted Variables</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {Array.from(extractedVariables.entries()).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-green-300">
                        <span className="text-gray-600 font-medium">{key}:</span>
                        <span className="font-semibold text-green-700">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="relative flex-1 min-h-0">
              <div
                className="h-full border rounded-lg overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                ref={scrollAreaRef}
                style={{ maxHeight: '400px' }}
              >
                <div className="space-y-4">
                {messages.length === 0 && !isSimulating && (
                  <div className="text-center text-gray-500 py-8">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Click "Start" to begin testing your workflow</p>
                    {nodes.length === 0 && (
                      <p className="text-sm mt-2 text-orange-600">
                        Add some nodes to your workflow first
                      </p>
                    )}
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className="flex flex-col space-y-1">
                    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <Card className={`max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : message.role === 'system'
                          ? 'bg-gray-100 border-gray-300'
                          : 'bg-white'
                      }`}>
                        <CardContent className="p-3">
                          <div className="flex items-start space-x-2">
                            {message.role === 'user' ? (
                              <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            ) : message.role === 'system' ? (
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-60" />
                            ) : (
                              <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className={`text-xs opacity-70 ${
                                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  {formatTime(message.timestamp)}
                                </span>
                                <div className="flex items-center gap-2">
                                  {message.tokenUsage && (
                                    <span className={`text-xs opacity-70 ${
                                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                                    }`} title={`Prompt: ${message.tokenUsage.prompt_tokens || 0} | Completion: ${message.tokenUsage.completion_tokens || 0}`}>
                                      🪙 {message.tokenUsage.total_tokens || 0}
                                    </span>
                                  )}
                                  {message.nodeName && (
                                    <Badge variant="secondary" className="text-xs">
                                      {message.nodeName}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <Card className="bg-white">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2">
                          <Bot className="h-4 w-4" />
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-gray-500">AI is thinking...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                </div>
              </div>

              {/* Scroll to bottom button */}
              {showScrollToBottom && (
                <Button
                  onClick={scrollToBottom}
                  size="sm"
                  className="absolute bottom-4 right-4 rounded-full shadow-lg z-10 bg-blue-500 hover:bg-blue-600 text-white"
                  variant="default"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Separator className="my-4" />

            {/* Chat Input Area */}
            <div className="flex-shrink-0">
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isSimulating ? "Type your message..." : "Start simulation to begin chatting"}
                  disabled={!isSimulating || isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || !isSimulating || isLoading}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Using Azure OpenAI (gpt-4o-mini) • {nodes.length} nodes in workflow
                </span>
                {isSimulating && currentNode && (
                  <div className="flex items-center space-x-3">
                    <span className="text-blue-600 font-medium">
                      {getNodeTypeDescription(currentNode.type)}
                    </span>
                    {conversationTurns > 0 && (
                      <span className="text-green-600">
                        {conversationTurns} exchange{conversationTurns !== 1 ? 's' : ''}
                      </span>
                    )}
                    {nodeContext && (
                      <span className="text-gray-400 max-w-xs truncate">
                        {nodeContext}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Info Footer */}
              <div className="text-xs text-gray-500 text-center mt-2">
                <p>{messages.length} messages • {nodes.length} nodes in workflow</p>
                {isUserScrolling && (
                  <p className="text-blue-600 mt-1">Scroll to bottom to see new messages</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="call" className="flex-1 flex flex-col min-h-0 mt-4">
            {/* Call Interface */}
            <div className="flex-1 flex flex-col space-y-4">
              {/* Phone Number Input */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <div className="flex space-x-2 mt-1">
                        <Input
                          id="phoneNumber"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="Enter phone number (e.g., +1234567890, 1234567890, or (123) 456-7890)"
                          disabled={isCallInProgress}
                          className="flex-1"
                        />
                        {!isCallInProgress ? (
                          <Button
                            onClick={handleMakeCall}
                            disabled={!phoneNumber.trim() || nodes.length === 0}
                            className="flex items-center space-x-2"
                          >
                            <PhoneCall className="h-4 w-4" />
                            <span>Call</span>
                          </Button>
                        ) : (
                          <Button
                            onClick={handleEndCall}
                            variant="destructive"
                            className="flex items-center space-x-2"
                          >
                            <Phone className="h-4 w-4" />
                            <span>End Call</span>
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Enter any phone number format - it will be automatically normalized for calling
                      </p>
                    </div>

                    {/* Twilio Configuration Info */}
                    <div className="text-xs text-gray-500 space-y-2">
                      <div className="flex items-center justify-between">
                        <p><strong>Twilio Configuration:</strong></p>
                        <Button
                          onClick={() => setIsEditingTwilio(true)}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          disabled={isCallInProgress}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </div>

                      {!isEditingTwilio ? (
                        <div className="space-y-1">
                          {isLoadingTwilioConfig ? (
                            <div className="text-blue-600">
                              <p>Loading configuration from backend...</p>
                              <p className="text-xs text-gray-500">This may take a moment if the backend is sleeping</p>
                            </div>
                          ) : configLoadFailed ? (
                            <div className="text-orange-600 bg-orange-50 p-3 rounded border">
                              <p className="font-medium">⚠️ Backend configuration unavailable</p>
                              <p className="text-sm mt-1">The backend is taking too long to respond. Please click "Edit" below to manually enter your Twilio credentials.</p>
                              <p className="text-xs text-gray-600 mt-2">This ensures you can make calls even when the backend is slow.</p>
                            </div>
                          ) : (
                            <>
                              <p>Account SID: {twilioConfig.accountSid}</p>
                              <p>From Number: {twilioConfig.phoneNumber}</p>
                              <p>Recording: {twilioConfig.recordCalls ? 'Enabled' : 'Disabled'}</p>
                              <p>Timeout: {twilioConfig.callTimeout} seconds</p>
                              {workflowConfig?.twilio ? (
                                <p className="text-green-600 text-xs">Using workflow-specific configuration</p>
                              ) : (
                                <p className="text-blue-600 text-xs">
                                  {isBackendAvailable() ? 'Using backend environment configuration' : 'Using default configuration'}
                                </p>
                              )}
                            </>
                          )}
                          <p className="text-orange-600 mt-2">
                            <strong>Mode:</strong> {isBackendAvailable() ? 'Real calls via backend API' : 'Demo mode - calls are simulated'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                          <div>
                            <Label htmlFor="edit-account-sid" className="text-xs">Account SID *</Label>
                            <Input
                              id="edit-account-sid"
                              value={twilioConfig.accountSid}
                              onChange={(e) => setTwilioConfig(prev => ({ ...prev, accountSid: e.target.value }))}
                              className="h-7 text-xs mt-1"
                              placeholder="AC..."
                            />
                          </div>

                          <div>
                            <Label htmlFor="edit-auth-token" className="text-xs">Auth Token *</Label>
                            <div className="relative">
                              <Input
                                id="edit-auth-token"
                                type={showAuthToken ? "text" : "password"}
                                value={twilioConfig.authToken}
                                onChange={(e) => setTwilioConfig(prev => ({ ...prev, authToken: e.target.value }))}
                                className="h-7 text-xs mt-1 pr-8"
                                placeholder="Your auth token"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-1 h-7 w-7 p-0"
                                onClick={() => setShowAuthToken(!showAuthToken)}
                              >
                                {showAuthToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="edit-phone-number" className="text-xs">Phone Number *</Label>
                            <Input
                              id="edit-phone-number"
                              value={twilioConfig.phoneNumber}
                              onChange={(e) => setTwilioConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                              className="h-7 text-xs mt-1"
                              placeholder="+1234567890"
                            />
                          </div>

                          <div>
                            <Label htmlFor="edit-call-timeout" className="text-xs">Call Timeout (5-600 seconds)</Label>
                            <Input
                              id="edit-call-timeout"
                              type="number"
                              min="5"
                              max="600"
                              value={twilioConfig.callTimeout}
                              onChange={(e) => setTwilioConfig(prev => ({ ...prev, callTimeout: parseInt(e.target.value) || 30 }))}
                              className="h-7 text-xs mt-1"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id="edit-record-calls"
                              checked={twilioConfig.recordCalls}
                              onCheckedChange={(checked) => setTwilioConfig(prev => ({ ...prev, recordCalls: checked }))}
                            />
                            <Label htmlFor="edit-record-calls" className="text-xs">Record calls</Label>
                          </div>

                          <div className="flex space-x-2 pt-2">
                            <Button
                              onClick={handleSaveTwilioConfig}
                              size="sm"
                              className="h-7 text-xs flex-1"
                              disabled={isSavingTwilio}
                            >
                              {isSavingTwilio ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                'Save'
                              )}
                            </Button>
                            <Button
                              onClick={handleCancelTwilioEdit}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Call Status and Messages */}
              <div className="flex-1">
                <ScrollArea className="h-full p-4 border rounded-lg">
                  <div className="space-y-4">
                    {!isCallInProgress && messages.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Enter a phone number and click "Call" to start</p>
                        {nodes.length === 0 && (
                          <p className="text-sm mt-2 text-orange-600">
                            Add some nodes to your workflow first
                          </p>
                        )}
                      </div>
                    )}

                    {isCallInProgress && (
                      <div className="text-center py-8">
                        <div className="flex items-center justify-center space-x-2 text-green-600">
                          <PhoneCall className="h-6 w-6 animate-pulse" />
                          <span className="font-medium">Call in progress...</span>
                        </div>
                        {currentCallSid && (
                          <p className="text-xs text-gray-500 mt-2">
                            Call ID: {currentCallSid}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show call-related messages */}
                    {messages.filter(msg => msg.role === 'system' && msg.content.includes('📞')).map((message) => (
                      <div key={message.id} className="flex justify-center">
                        <Card className="bg-gray-100 border-gray-300">
                          <CardContent className="p-3">
                            <div className="flex items-center space-x-2">
                              <AlertCircle className="h-4 w-4 opacity-60" />
                              <p className="text-sm">{message.content}</p>
                              <span className="text-xs text-gray-500">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Call Info Footer */}
              <div className="text-xs text-gray-500 text-center">
                <p>{isBackendAvailable() ? 'Real Calls: Connected to backend API' : 'Demo Mode: Calls are simulated'} • {nodes.length} nodes in workflow</p>
                {workflowConfig?.twilio ? (
                  <p>Using workflow Twilio configuration {isBackendAvailable() ? '' : '(demo)'}</p>
                ) : (
                  <p>Using default Twilio configuration {isBackendAvailable() ? '' : '(demo)'}</p>
                )}
                {!isBackendAvailable() && (
                  <p className="text-blue-600 mt-1">Deploy the backend API to make real calls</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PlaygroundModal;
