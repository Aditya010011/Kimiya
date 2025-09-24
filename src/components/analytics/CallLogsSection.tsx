import React, { useState, useMemo } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Play,
  Eye,
  Download,
  RefreshCw,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Volume2,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CallRecord, CallAnalytics } from '@/types/userAnalytics';

interface CallLogsSectionProps {
  callAnalytics: CallAnalytics;
  callRecords: CallRecord[];
  userName: string;
  onRefresh?: () => void;
  onViewTranscription?: (callRecord: CallRecord) => void;
  onViewSummary?: (callRecord: CallRecord) => void;
  onPlayRecording?: (callRecord: CallRecord) => void;
  onViewDetails?: (callRecord: CallRecord) => void;
}

const CallLogsSection: React.FC<CallLogsSectionProps> = ({
  callAnalytics,
  callRecords,
  userName,
  onRefresh,
  onViewTranscription,
  onViewSummary,
  onPlayRecording,
  onViewDetails
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');

  // Get unique workflows for filtering
  const workflows = useMemo(() => {
    const uniqueWorkflows = Array.from(new Set(
      callRecords
        .filter(record => record.workflow_name)
        .map(record => record.workflow_name!)
    ));
    return uniqueWorkflows.map(name => ({
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name
    }));
  }, [callRecords]);

  // Filter call records based on current filters
  const filteredRecords = useMemo(() => {
    return callRecords.filter(record => {
      const matchesSearch = searchTerm === '' || 
        record.from_number.includes(searchTerm) ||
        record.to_number.includes(searchTerm) ||
        (record.workflow_name && record.workflow_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.metadata.caller_name && record.metadata.caller_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDirection = selectedDirection === 'all' || record.direction === selectedDirection;
      const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
      const matchesWorkflow = selectedWorkflow === 'all' || 
        (record.workflow_name && record.workflow_name.toLowerCase().replace(/\s+/g, '_') === selectedWorkflow);
      
      // Simple date filtering
      const matchesDate = selectedDateRange === 'all' || (() => {
        const recordDate = new Date(record.start_time);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (selectedDateRange) {
          case '7d': return daysDiff <= 7;
          case '30d': return daysDiff <= 30;
          case '90d': return daysDiff <= 90;
          default: return true;
        }
      })();
      
      return matchesSearch && matchesDirection && matchesStatus && matchesWorkflow && matchesDate;
    });
  }, [callRecords, searchTerm, selectedDirection, selectedStatus, selectedWorkflow, selectedDateRange]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    // Simple phone number formatting
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phoneNumber;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'answered': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'declined': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'busy': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'no-answer': return <AlertCircle className="h-4 w-4 text-gray-500" />;
      case 'hung-up': return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'answered': return 'default';
      case 'declined': return 'destructive';
      case 'busy': return 'secondary';
      case 'no-answer': return 'outline';
      case 'hung-up': return 'secondary';
      case 'failed': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'outline';
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' ? 
      <PhoneIncoming className="h-4 w-4 text-blue-500" /> : 
      <PhoneOutgoing className="h-4 w-4 text-green-500" />;
  };

  const handleExportCalls = () => {
    toast.success('Call logs exported successfully');
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Calls</p>
                <p className="text-2xl font-bold">{callAnalytics.total_calls}</p>
              </div>
              <Phone className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {callAnalytics.answered_calls} answered • {callAnalytics.missed_calls} missed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Answer Rate</p>
                <p className="text-2xl font-bold">{(callAnalytics.answer_rate * 100).toFixed(1)}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Progress value={callAnalytics.answer_rate * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(callAnalytics.average_duration)}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Total: {formatDuration(callAnalytics.total_duration)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold">${callAnalytics.cost_summary.total_cost.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Avg: ${callAnalytics.cost_summary.average_cost_per_call.toFixed(3)}/call
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {userName}'s Call Logs
              </CardTitle>
              <CardDescription>
                Complete call history and telephony records
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCalls}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by phone number, caller name, or workflow..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedDirection} onValueChange={setSelectedDirection}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Calls</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="answered">Answered</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="no-answer">No Answer</SelectItem>
                <SelectItem value="hung-up">Hung Up</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workflows</SelectItem>
                {workflows.map(workflow => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Call Records Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Direction</TableHead>
                  <TableHead>Phone Numbers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No call records found matching your filters.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.call_id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(record.direction)}
                          <span className="capitalize text-sm">{record.direction}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {record.direction === 'inbound' ? 
                              `From: ${formatPhoneNumber(record.from_number)}` : 
                              `To: ${formatPhoneNumber(record.to_number)}`
                            }
                          </div>
                          {record.metadata.caller_name && (
                            <div className="text-sm text-gray-500">{record.metadata.caller_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(record.status)}>
                          {getStatusIcon(record.status)}
                          <span className="ml-1 capitalize">{record.status.replace('-', ' ')}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatDuration(record.duration)}</div>
                      </TableCell>
                      <TableCell>
                        {record.workflow_name ? (
                          <Badge variant="outline">{record.workflow_name}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatRelativeTime(record.start_time)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">${record.cost.toFixed(3)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Call Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {record.transcription && (
                              <DropdownMenuItem onClick={() => onViewTranscription?.(record)}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Transcription
                              </DropdownMenuItem>
                            )}
                            {record.summary && (
                              <DropdownMenuItem onClick={() => onViewSummary?.(record)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Summary
                              </DropdownMenuItem>
                            )}
                            {record.recording_url && (
                              <DropdownMenuItem onClick={() => onPlayRecording?.(record)}>
                                <Play className="h-4 w-4 mr-2" />
                                Play Recording
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onViewDetails?.(record)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallLogsSection;
