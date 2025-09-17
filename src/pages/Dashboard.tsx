import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Clock,
  TrendingUp,
  FileText,
  Play,
  Edit,
  Trash2,
  Download,
  Upload,
  User,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useFlowStore } from '../stores/flowStore';
import { WorkflowService, Workflow } from '../services/workflowService';
import DashboardHeader from '@/components/layout/DashboardHeader';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { createWorkflow } = useFlowStore();

  // State for workflows
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [myWorkflows, setMyWorkflows] = useState<Workflow[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [isCreating, setIsCreating] = useState(false);





  // Helper function to render workflow list
  const renderWorkflowList = (workflows: Workflow[], isLoading: boolean, emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading workflows...</span>
        </div>
      );
    }

    if (workflows.length === 0) {
      return (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
          <p className="text-gray-500 mb-4">{emptyMessage}</p>
          <Button onClick={handleNewWorkflow} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create Workflow'}
          </Button>
        </div>
      );
    }

    return (
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  // Load workflows from database
  useEffect(() => {
    loadAllWorkflows();
    loadMyWorkflows();
  }, []);

  const loadAllWorkflows = async () => {
    try {
      setIsLoadingAll(true);
      const data = await WorkflowService.getWorkflows();
      setAllWorkflows(data.workflows);
    } catch (error) {
      console.error('Failed to load all workflows:', error);
      toast.error('Failed to load all workflows');
    } finally {
      setIsLoadingAll(false);
    }
  };

  const loadMyWorkflows = async () => {
    try {
      setIsLoadingMy(true);
      const data = await WorkflowService.getMyWorkflows();
      setMyWorkflows(data.workflows);
    } catch (error) {
      console.error('Failed to load my workflows:', error);
      toast.error('Failed to load my workflows');
    } finally {
      setIsLoadingMy(false);
    }
  };

  const handleNewWorkflow = async () => {
    try {
      setIsCreating(true);
      const workflowName = `New Workflow ${new Date().toLocaleDateString()}`;
      console.log('🔧 Creating workflow with name:', workflowName);

      const newWorkflow = await createWorkflow(workflowName, 'A new workflow created from the dashboard');
      console.log('✅ Workflow created:', newWorkflow);

      if (!newWorkflow || !newWorkflow.id) {
        throw new Error('Created workflow is missing ID');
      }

      toast.success('New workflow created successfully!');
      // Navigate to builder with the new workflow ID
      navigate(`/builder?workflowId=${newWorkflow.id}`);
      // Refresh workflows lists
      loadAllWorkflows();
      loadMyWorkflows();
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast.error(`Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportWorkflow = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          console.log('📥 Dashboard: Starting workflow import to database...');

          // Import workflow to database (same as flow builder)
          const result = await WorkflowService.importWorkflowFromFile(file, false, null);

          console.log('✅ Dashboard: Workflow imported to database successfully');
          console.log('📊 Import result:', result);

          // Show success message
          const importedItems = [];
          if (result.imported.nodeCount > 0) importedItems.push(`${result.imported.nodeCount} nodes`);
          if (result.imported.edgeCount > 0) importedItems.push(`${result.imported.edgeCount} edges`);
          if (result.imported.configCount > 0) importedItems.push(`${result.imported.configCount} configs`);

          const itemsText = importedItems.length > 0 ? ` (${importedItems.join(', ')})` : '';
          toast.success(`Workflow "${result.workflow.name}" imported and saved to database!${itemsText}`);

          // Refresh workflows lists to show the new imported workflow
          loadAllWorkflows();
          loadMyWorkflows();

          // Navigate to the builder with the imported workflow
          navigate(`/builder?workflowId=${result.workflow.id}`);

        } catch (error) {
          console.error('Dashboard import error:', error);
          toast.error(`Failed to import workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };
    input.click();
  };

  const handleEditWorkflow = (workflowId: number) => {
    navigate(`/builder?workflowId=${workflowId}`);
  };

  const handleDeleteWorkflow = async (workflowId: number, workflowName: string) => {
    if (!confirm(`Are you sure you want to delete "${workflowName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await WorkflowService.deleteWorkflow(workflowId);
      toast.success(`Workflow "${workflowName}" deleted successfully`);
      // Refresh workflows lists
      loadAllWorkflows();
      loadMyWorkflows();
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
      title: 'My Workflows',
      value: myWorkflows.length.toString(),
      icon: User,
      description: 'Workflows you created'
    },
    {
      title: 'All Workflows',
      value: allWorkflows.length.toString(),
      icon: FileText,
      description: 'All workflows in the system'
    },
    {
      title: 'Active Workflows',
      value: allWorkflows.filter(w => w.is_active).length.toString(),
      icon: Play,
      description: 'Currently active workflows'
    },
    {
      title: 'Total Nodes',
      value: allWorkflows.reduce((sum, w) => sum + (w.node_count || 0), 0).toString(),
      icon: TrendingUp,
      description: 'Across all workflows'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <DashboardHeader
        title="Kimiyi Dashboard"
        subtitle="Manage voice agent workflows"
        showNewWorkflowButton={true}
        isCreating={isCreating}
        onNewWorkflow={handleNewWorkflow}
      />

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

        {/* My Workflows Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              My Workflows
            </CardTitle>
            <CardDescription>Workflows you created</CardDescription>
          </CardHeader>
          <CardContent>
            {renderWorkflowList(myWorkflows, isLoadingMy, "Create your first workflow to get started")}
          </CardContent>
        </Card>

        {/* All Workflows Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              All Workflows
            </CardTitle>
            <CardDescription>All workflows in the system (shared across all users)</CardDescription>
          </CardHeader>
          <CardContent>
            {renderWorkflowList(allWorkflows, isLoadingAll, "No workflows exist yet. Create the first one!")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
