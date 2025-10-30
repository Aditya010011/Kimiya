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
  Loader2,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { useFlowStore } from '../stores/flowStore';
import { WorkflowService, Workflow, WorkflowTemplate } from '../services/workflowService';
import DashboardHeader from '@/components/layout/DashboardHeader';
import WorkflowCard from '@/components/workflows/WorkflowCard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { createWorkflow } = useFlowStore();

  // State for workflows and templates
  const [myWorkflows, setMyWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates'>('workflows');
  const [userRole, setUserRole] = useState<string>('user');

  // Pagination state
  const [workflowPage, setWorkflowPage] = useState(1);
  const [templatePage, setTemplatePage] = useState(1);
  const [workflowsTotal, setWorkflowsTotal] = useState(0);
  const [templatesTotal, setTemplatesTotal] = useState(0);
  const [isLoadingMoreWorkflows, setIsLoadingMoreWorkflows] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);

  // Statistics state (from database)
  const [stats, setStats] = useState({
    myWorkflowsCount: 0,
    activeWorkflowsCount: 0,
    totalNodesCount: 0,
    templatesCount: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const ITEMS_PER_PAGE = 3;





  // Helper function to render card grid with load more
  const renderCardGrid = (
    items: (Workflow | WorkflowTemplate)[],
    isLoading: boolean,
    isLoadingMore: boolean,
    emptyMessage: string,
    isTemplate: boolean = false,
    total: number = 0,
    onLoadMore?: () => void
  ) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading {isTemplate ? 'templates' : 'workflows'}...</span>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {isTemplate ? 'templates' : 'workflows'} yet
          </h3>
          <p className="text-gray-500 mb-4">{emptyMessage}</p>
          {!isTemplate && (
            <Button onClick={handleNewWorkflow} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create Workflow'}
            </Button>
          )}
        </div>
      );
    }

    const hasMore = items.length < total;

    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {items.map((item) => (
            <WorkflowCard
              key={item.id}
              id={item.id}
              name={item.name}
              description={item.description}
              created_at={item.created_at}
              updated_at={item.updated_at}
              created_by_email={item.created_by_email}
              node_count={'node_count' in item ? item.node_count : 0}
              edge_count={'edge_count' in item ? item.edge_count : 0}
              is_active={item.is_active}
              isTemplate={isTemplate}
              isAdmin={userRole === 'admin'}
              onEdit={isTemplate ? handleEditTemplate : handleEditWorkflow}
              onDelete={isTemplate ? handleDeleteTemplate : handleDeleteWorkflow}
              onClone={isTemplate ? handleCloneTemplate : undefined}
            />
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              variant="outline"
              className="w-full md:w-auto"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading more...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Load More ({items.length} of {total})
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };
  // Load statistics from database
  const loadDashboardStats = async () => {
    try {
      setIsLoadingStats(true);
      const [workflowStats, templatesCount] = await Promise.all([
        WorkflowService.getDashboardStats(),
        WorkflowService.getTemplatesCount()
      ]);

      setStats({
        myWorkflowsCount: workflowStats.myWorkflowsCount,
        activeWorkflowsCount: workflowStats.activeWorkflowsCount,
        totalNodesCount: workflowStats.totalNodesCount,
        templatesCount: templatesCount
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      // Don't show error toast for stats - they're secondary
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Load workflows and templates from database
  useEffect(() => {
    loadMyWorkflows();
    loadTemplates();
    loadDashboardStats();
    // Get user role from localStorage or auth service
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        setUserRole(parsed.role || 'user');
      } catch (e) {
        console.error('Failed to parse user info:', e);
      }
    }
  }, []);

  const loadMyWorkflows = async (page = 1, append = false) => {
    try {
      if (!append) setIsLoadingMy(true);
      else setIsLoadingMoreWorkflows(true);

      const data = await WorkflowService.getMyWorkflows(page, ITEMS_PER_PAGE);

      if (append) {
        setMyWorkflows(prev => [...prev, ...data.workflows]);
      } else {
        setMyWorkflows(data.workflows);
      }

      setWorkflowsTotal(data.pagination.total);
      setWorkflowPage(page);
    } catch (error) {
      console.error('Failed to load my workflows:', error);
      toast.error('Failed to load my workflows');
    } finally {
      setIsLoadingMy(false);
      setIsLoadingMoreWorkflows(false);
    }
  };

  const loadTemplates = async (page = 1, append = false) => {
    try {
      if (!append) setIsLoadingTemplates(true);
      else setIsLoadingMoreTemplates(true);

      const data = await WorkflowService.getTemplates(page, ITEMS_PER_PAGE);

      const templatesData = data.templates;
      const totalCount = data.pagination.total;

      if (append) {
        setTemplates(prev => [...prev, ...templatesData]);
      } else {
        setTemplates(templatesData);
      }

      setTemplatesTotal(totalCount);
      setTemplatePage(page);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoadingTemplates(false);
      setIsLoadingMoreTemplates(false);
    }
  };

  const handleLoadMoreWorkflows = () => {
    loadMyWorkflows(workflowPage + 1, true);
  };

  const handleLoadMoreTemplates = () => {
    loadTemplates(templatePage + 1, true);
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
      // Refresh workflows lists and stats
      loadAllWorkflows();
      loadMyWorkflows();
      loadDashboardStats();
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

          // Refresh workflows lists and stats to show the new imported workflow
          loadAllWorkflows();
          loadMyWorkflows();
          loadDashboardStats();

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
      // Refresh workflows list and stats
      loadMyWorkflows();
      loadDashboardStats();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast.error('Failed to delete workflow');
    }
  };

  const handleEditTemplate = (templateId: number) => {
    // Navigate to template editor (if available) or show edit modal
    toast.info('Template editing coming soon');
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (!confirm(`Are you sure you want to delete template "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await WorkflowService.deleteTemplate(templateId);
      toast.success(`Template "${templateName}" deleted successfully`);
      // Refresh templates list and stats
      loadTemplates();
      loadDashboardStats();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCloneTemplate = async (templateId: number) => {
    try {
      const result = await WorkflowService.cloneTemplate(templateId);
      toast.success(`Template cloned successfully! Created workflow: "${result.workflow.name}"`);
      // Refresh workflows list and stats
      loadMyWorkflows();
      loadDashboardStats();
      // Navigate to the new workflow
      navigate(`/builder?workflowId=${result.workflow.id}`);
    } catch (error) {
      console.error('Failed to clone template:', error);
      toast.error(`Failed to clone template: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const statsCards = [
    {
      title: 'My Workflows',
      value: stats.myWorkflowsCount.toString(),
      icon: User,
      description: 'Workflows you created'
    },
    {
      title: 'Available Templates',
      value: stats.templatesCount.toString(),
      icon: FileText,
      description: 'Templates to clone from'
    },
    {
      title: 'Active Workflows',
      value: stats.activeWorkflowsCount.toString(),
      icon: Play,
      description: 'Your active workflows'
    },
    {
      title: 'Total Nodes',
      value: stats.totalNodesCount.toString(),
      icon: TrendingUp,
      description: 'Across your workflows'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <DashboardHeader
        title="Kimiyi Dashboard"
        subtitle="Manage voice agent workflows"
        showNewWorkflowButton={false}
        isCreating={isCreating}
        onNewWorkflow={handleNewWorkflow}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {isLoadingStats ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    stat.value
                  )}
                </div>
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

        {/* Workflows and Templates Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflows & Templates</CardTitle>
                <CardDescription>Manage your workflows and explore templates</CardDescription>
              </div>
              {activeTab === 'workflows' && (
                <Button onClick={handleNewWorkflow} disabled={isCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreating ? 'Creating...' : 'New Workflow'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Tab Navigation */}
            <div className="flex border-b mb-6">
              <button
                onClick={() => setActiveTab('workflows')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'workflows'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                My Workflows ({myWorkflows.length}{workflowsTotal > myWorkflows.length ? `/${workflowsTotal}` : ''})
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Templates ({templates.length}{templatesTotal > templates.length ? `/${templatesTotal}` : ''})
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'workflows' && (
              renderCardGrid(
                myWorkflows,
                isLoadingMy,
                isLoadingMoreWorkflows,
                'Create your first workflow to get started',
                false,
                workflowsTotal,
                handleLoadMoreWorkflows
              )
            )}
            {activeTab === 'templates' && (
              renderCardGrid(
                templates,
                isLoadingTemplates,
                isLoadingMoreTemplates,
                'No templates available yet',
                true,
                templatesTotal,
                handleLoadMoreTemplates
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
