import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Phone,
  Clock,
  Users,
  TrendingUp,
  FileText,
  Settings,
  Play,
  Edit,
  Trash2,
  Download,
  Upload,
  User,
  LogOut,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useFlowStore } from '../stores/flowStore';
import { useAuthStore } from '../stores/authStore';
import { WorkflowService, Workflow } from '../services/workflowService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { importFlow, createWorkflow } = useFlowStore();
  const { user, logout } = useAuthStore();

  // State for workflows
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);



  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const getUserInitials = (user: any) => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserDisplayName = (user: any) => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user?.first_name) {
      return user.first_name;
    }
    return user?.email || 'User';
  };
  // Load workflows from database
  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setIsLoading(true);
      const data = await WorkflowService.getWorkflows();
      setWorkflows(data.workflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewWorkflow = async () => {
    try {
      setIsCreating(true);
      const workflowName = `New Workflow ${new Date().toLocaleDateString()}`;
      await createWorkflow(workflowName, 'A new workflow created from the dashboard');
      toast.success('New workflow created successfully!');
      navigate('/builder');
      // Refresh workflows list
      loadWorkflows();
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast.error('Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportWorkflow = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const flowData = JSON.parse(e.target?.result as string);

            // Validate the imported data structure
            if (!flowData || typeof flowData !== 'object') {
              throw new Error('Invalid file format');
            }

            // Check if it has the expected structure
            if (!flowData.nodes && !flowData.edges && !flowData.name) {
              throw new Error('File does not contain valid workflow data');
            }

            // Ensure nodes and edges are arrays
            if (flowData.nodes && !Array.isArray(flowData.nodes)) {
              throw new Error('Invalid nodes data format');
            }
            if (flowData.edges && !Array.isArray(flowData.edges)) {
              throw new Error('Invalid edges data format');
            }

            // Use the dedicated import method for proper handling
            try {
              console.log('📥 Dashboard: Importing workflow...');
              importFlow(flowData);
              console.log('✅ Dashboard: Import completed successfully');
            } catch (loadError) {
              console.error('❌ Dashboard: Import failed:', loadError);
              throw new Error(`Failed to import workflow: ${loadError instanceof Error ? loadError.message : 'Unknown import error'}`);
            }

            // Navigate to the builder with the imported workflow
            navigate('/builder');

            // Show success message
            const importedItems = [];
            if (flowData.nodes?.length) importedItems.push(`${flowData.nodes.length} nodes`);
            if (flowData.edges?.length) importedItems.push(`${flowData.edges.length} edges`);
            if (flowData.variables?.length) importedItems.push(`${flowData.variables.length} variables`);
            if (flowData.config) importedItems.push('configuration');

            const itemsText = importedItems.length > 0 ? ` (${importedItems.join(', ')})` : '';
            toast.success(`Workflow "${flowData.name || 'Untitled'}" imported successfully!${itemsText}`);
          } catch (error) {
            console.error('Import error:', error);
            toast.error(`Failed to import workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleEditWorkflow = (workflowId: number) => {
    navigate(`/builder?workflow=${workflowId}`);
  };

  const handleDeleteWorkflow = async (workflowId: number, workflowName: string) => {
    if (!confirm(`Are you sure you want to delete "${workflowName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await WorkflowService.deleteWorkflow(workflowId);
      toast.success(`Workflow "${workflowName}" deleted successfully`);
      // Refresh workflows list
      loadWorkflows();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast.error('Failed to delete workflow');
    }
  };

  const handleExportWorkflow = async (workflowId: number, workflowName: string) => {
    try {
      const flowData = await WorkflowService.getWorkflowFlow(workflowId);
      const workflow = await WorkflowService.getWorkflow(workflowId);

      const exportData = {
        name: workflow.name,
        description: workflow.description,
        nodes: flowData.nodes,
        edges: flowData.edges,
        configs: workflow.configs,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflowName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Workflow "${workflowName}" exported successfully`);
    } catch (error) {
      console.error('Failed to export workflow:', error);
      toast.error('Failed to export workflow');
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Active' : 'Inactive';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const stats = [
    {
      title: 'Total Workflows',
      value: workflows.length.toString(),
      icon: FileText,
      description: 'All workflows in your account'
    },
    {
      title: 'Active Workflows',
      value: workflows.filter(w => w.is_active).length.toString(),
      icon: Play,
      description: 'Currently active workflows'
    },
    {
      title: 'Total Nodes',
      value: workflows.reduce((sum, w) => sum + (w.node_count || 0), 0).toString(),
      icon: TrendingUp,
      description: 'Across all workflows'
    },
    {
      title: 'Total Edges',
      value: workflows.reduce((sum, w) => sum + (w.edge_count || 0), 0).toString(),
      icon: Users,
      description: 'Connections between nodes'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <img src="/icon.png" alt="Kimiyi Logo" className="h-8 w-8 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kimiyi Dashboard</h1>
              <p className="text-sm text-gray-500">Manage your voice agent workflows</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleNewWorkflow}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isCreating ? 'Creating...' : 'New Workflow'}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-600 text-white text-sm">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {getUserDisplayName(user)}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/builder')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Workflow Builder</span>
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Users</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center"
                onClick={handleNewWorkflow}
              >
                <Plus className="h-6 w-6 mb-2" />
                Create New Workflow
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={handleImportWorkflow}
              >
                <Upload className="h-6 w-6 mb-2" />
                Import Workflow
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => window.open('/docs', '_blank')}
              >
                <FileText className="h-6 w-6 mb-2" />
                View Documentation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Workflows List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Workflows</CardTitle>
            <CardDescription>Manage and monitor your voice agent workflows</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading workflows...</span>
              </div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
                <p className="text-gray-500 mb-4">Create your first workflow to get started</p>
                <Button onClick={handleNewWorkflow} disabled={isCreating}>
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {isCreating ? 'Creating...' : 'Create Workflow'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                          <Badge className={getStatusColor(workflow.is_active)}>
                            {getStatusText(workflow.is_active)}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{workflow.description || 'No description'}</p>
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Modified {formatDate(workflow.updated_at)}
                          </div>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            {workflow.node_count || 0} nodes
                          </div>
                          <div className="flex items-center">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            {workflow.edge_count || 0} edges
                          </div>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            {workflow.created_by_email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditWorkflow(workflow.id)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportWorkflow(workflow.id, workflow.name)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
