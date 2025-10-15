/**
 * Inbound Call Tester Component
 * 
 * Web-based interface for testing inbound call functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Settings,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import twilioVoiceService from '@/services/twilioVoiceService';

interface CallState {
  status: 'idle' | 'initializing' | 'ready' | 'calling' | 'connected' | 'disconnected' | 'error';
  isRegistered: boolean;
  hasActiveCall: boolean;
  isMuted: boolean;
  error?: string;
  callDuration: number;
  identity?: string;
}

interface Workflow {
  id: number;
  workflowId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function InboundCallTester() {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    isRegistered: false,
    hasActiveCall: false,
    isMuted: false,
    callDuration: 0
  });

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('');
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState<boolean>(true);
  const [customIdentity, setCustomIdentity] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [volumeLevels, setVolumeLevels] = useState({ input: 0, output: 0 });

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set up event listeners
    const setupEventListeners = () => {
      twilioVoiceService.on('initialized', (data) => {
        addLog(`✅ Initialized with identity: ${data.identity}`);
        setCallState(prev => ({ 
          ...prev, 
          status: 'ready', 
          identity: data.identity 
        }));
      });

      twilioVoiceService.on('registered', () => {
        addLog('📱 Device registered successfully');
        setCallState(prev => ({ ...prev, isRegistered: true }));
      });

      twilioVoiceService.on('unregistered', () => {
        addLog('📱 Device unregistered');
        setCallState(prev => ({ ...prev, isRegistered: false }));
      });

      twilioVoiceService.on('callStarted', (data) => {
        addLog(`📞 Call started - Session: ${data.session.sessionId}`);
        setCallState(prev => ({ ...prev, status: 'calling', hasActiveCall: true }));
        startCallTimer();
      });

      twilioVoiceService.on('callAccepted', () => {
        addLog('✅ Call connected');
        setCallState(prev => ({ ...prev, status: 'connected' }));
      });

      twilioVoiceService.on('callDisconnected', () => {
        addLog('📞 Call disconnected');
        setCallState(prev => ({ 
          ...prev, 
          status: 'ready', 
          hasActiveCall: false,
          callDuration: 0
        }));
        stopCallTimer();
      });

      twilioVoiceService.on('callError', (data) => {
        addLog(`❌ Call error: ${data.error}`);
        setCallState(prev => ({ 
          ...prev, 
          status: 'error', 
          error: data.error,
          hasActiveCall: false
        }));
        stopCallTimer();
      });

      twilioVoiceService.on('muteToggled', (data) => {
        addLog(`🎤 Microphone ${data.isMuted ? 'muted' : 'unmuted'}`);
        setCallState(prev => ({ ...prev, isMuted: data.isMuted }));
      });

      twilioVoiceService.on('volume', (data) => {
        setVolumeLevels({ 
          input: Math.round(data.inputVolume * 100), 
          output: Math.round(data.outputVolume * 100) 
        });
      });

      twilioVoiceService.on('error', (data) => {
        addLog(`❌ Error: ${data.error}`);
        setCallState(prev => ({ ...prev, status: 'error', error: data.error }));
      });
    };

    setupEventListeners();

    // Load available workflows
    loadWorkflows();

    // Cleanup on unmount
    return () => {
      stopCallTimer();
      twilioVoiceService.destroy();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll logs to bottom
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const loadWorkflows = async () => {
    try {
      setIsLoadingWorkflows(true);
      addLog('📋 Loading available workflows...');

      const response = await fetch('/api/inbound/workflows');
      const data = await response.json();

      if (data.success) {
        setWorkflows(data.workflows);
        addLog(`✅ Loaded ${data.count} workflows`);

        // Set selection to first workflow if available
        if (data.workflows.length > 0) {
          setSelectedWorkflow(data.workflows[0].workflowId);
        }
      } else {
        addLog(`❌ Failed to load workflows: ${data.error}`);
      }
    } catch (error: any) {
      addLog(`❌ Error loading workflows: ${error.message}`);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInitialize = async () => {
    setCallState(prev => ({ ...prev, status: 'initializing', error: undefined }));
    addLog('🎯 Initializing Twilio Voice SDK...');
    
    const identity = customIdentity.trim() || undefined;
    const success = await twilioVoiceService.initialize(identity);
    
    if (!success) {
      setCallState(prev => ({ ...prev, status: 'error' }));
    }
  };

  const handleMakeCall = async () => {
    const workflow = workflows.find(w => w.workflowId === selectedWorkflow);
    if (!workflow) {
      addLog('❌ No workflow selected');
      return;
    }

    addLog(`📞 Starting test call - Workflow: ${workflow.name}`);

    const success = await twilioVoiceService.makeCall({
      workflowId: workflow.workflowId,
      workflowName: workflow.name,
      testScenario: workflow.workflowId
    });

    if (!success) {
      addLog('❌ Failed to start call');
    }
  };

  const handleDisconnect = () => {
    addLog('📞 Disconnecting call...');
    twilioVoiceService.disconnectCall();
  };

  const handleToggleMute = () => {
    twilioVoiceService.toggleMute();
  };

  const handleSendDTMF = (digit: string) => {
    twilioVoiceService.sendDTMF(digit);
    addLog(`📱 DTMF sent: ${digit}`);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'calling': return 'bg-yellow-500';
      case 'connected': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      case 'initializing': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="h-4 w-4" />;
      case 'calling': return <Phone className="h-4 w-4" />;
      case 'connected': return <PhoneCall className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'initializing': return <Loader2 className="h-4 w-4 animate-spin" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbound Call Tester</h1>
          <p className="text-muted-foreground">
            Test inbound call functionality using web-based calling
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={`${getStatusColor(callState.status)} text-white`}
        >
          <span className="flex items-center gap-2">
            {getStatusIcon(callState.status)}
            {callState.status.toUpperCase()}
          </span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Call Controls
            </CardTitle>
            <CardDescription>
              Initialize the service and make test calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Identity Input */}
            <div className="space-y-2">
              <Label htmlFor="identity">Identity (Optional)</Label>
              <Input
                id="identity"
                placeholder="Leave empty for auto-generated"
                value={customIdentity}
                onChange={(e) => setCustomIdentity(e.target.value)}
                disabled={callState.status !== 'idle'}
              />
              {callState.identity && (
                <p className="text-sm text-muted-foreground">
                  Current identity: {callState.identity}
                </p>
              )}
            </div>

            {/* Workflow Selection */}
            <div className="space-y-2">
              <Label htmlFor="workflow">Workflow</Label>
              <Select
                value={selectedWorkflow}
                onValueChange={setSelectedWorkflow}
                disabled={callState.hasActiveCall || isLoadingWorkflows}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingWorkflows ? "Loading workflows..." : "Select a workflow"} />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((workflow) => (
                    <SelectItem key={workflow.id} value={workflow.workflowId}>
                      <div>
                        <div className="font-medium">{workflow.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {workflow.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workflows.length === 0 && !isLoadingWorkflows && (
                <p className="text-sm text-muted-foreground">No workflows available</p>
              )}
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-2">
              {callState.status === 'idle' && (
                <Button 
                  onClick={handleInitialize} 
                  className="w-full"
                  disabled={callState.status === 'initializing'}
                >
                  {callState.status === 'initializing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Initialize Voice SDK
                    </>
                  )}
                </Button>
              )}

              {callState.status === 'ready' && !callState.hasActiveCall && (
                <Button 
                  onClick={handleMakeCall} 
                  className="w-full"
                  variant="default"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Start Test Call
                </Button>
              )}

              {callState.hasActiveCall && (
                <div className="space-y-2">
                  <Button 
                    onClick={handleDisconnect} 
                    variant="destructive" 
                    className="w-full"
                  >
                    <PhoneOff className="mr-2 h-4 w-4" />
                    End Call ({formatDuration(callState.callDuration)})
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleToggleMute} 
                      variant="outline" 
                      className="flex-1"
                    >
                      {callState.isMuted ? (
                        <>
                          <MicOff className="mr-2 h-4 w-4" />
                          Unmute
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-4 w-4" />
                          Mute
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* DTMF Keypad */}
            {callState.hasActiveCall && (
              <>
                <Separator />
                <div>
                  <Label>DTMF Keypad</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <Button
                        key={digit}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendDTMF(digit)}
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Volume Levels */}
            {callState.hasActiveCall && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Audio Levels</Label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mic className="h-4 w-4" />
                      <span className="w-12">Input:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-100"
                          style={{ width: `${volumeLevels.input}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs">{volumeLevels.input}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Volume2 className="h-4 w-4" />
                      <span className="w-12">Output:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                          style={{ width: `${volumeLevels.output}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs">{volumeLevels.output}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Error Display */}
            {callState.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{callState.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Logs Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Call Logs</CardTitle>
                <CardDescription>Real-time activity logs</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No logs yet...</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
