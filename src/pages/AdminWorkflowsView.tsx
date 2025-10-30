import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Search, RefreshCw } from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { WorkflowService, Workflow } from '@/services/workflowService';
import WorkflowCard from '@/components/workflows/WorkflowCard';

const AdminWorkflowsView: React.FC = () => {
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const ITEMS_PER_PAGE = 3;

  const loadAllWorkflows = async (pageNum = 1, append = false) => {
    try {
      if (!append) setIsLoading(true);
      else setIsLoadingMore(true);

      const data = await WorkflowService.getWorkflows(pageNum, ITEMS_PER_PAGE);

      if (append) {
        setAllWorkflows(prev => [...prev, ...data.workflows]);
      } else {
        setAllWorkflows(data.workflows);
      }

      setTotal(data.pagination.total);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    loadAllWorkflows(page + 1, true);
  };

  const handleRefresh = () => {
    setPage(1);
    loadAllWorkflows(1, false);
  };

  const handleDeleteWorkflow = async (workflowId: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await WorkflowService.deleteWorkflow(workflowId);
      toast.success('Workflow deleted successfully');
      handleRefresh();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast.error('Failed to delete workflow');
    }
  };

  const filteredWorkflows = allWorkflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workflow.created_by_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasMore = allWorkflows.length < total;

  useEffect(() => {
    loadAllWorkflows(1, false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Workflows</h1>
          <p className="text-gray-600 mt-2">View and manage all workflows created by users</p>
        </div>

        {/* Stats Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Workflows</p>
                <p className="text-2xl font-bold text-gray-900">{total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Loaded</p>
                <p className="text-2xl font-bold text-gray-900">{allWorkflows.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className="text-2xl font-bold text-gray-900">{Math.max(0, total - allWorkflows.length)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name, description, or creator email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="icon"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Workflows Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
            <CardDescription>
              {filteredWorkflows.length} of {allWorkflows.length} workflows displayed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading workflows...</span>
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No workflows found</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  {filteredWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      id={workflow.id}
                      name={workflow.name}
                      description={workflow.description}
                      created_at={workflow.created_at}
                      updated_at={workflow.updated_at}
                      created_by_email={workflow.created_by_email}
                      node_count={workflow.node_count}
                      edge_count={workflow.edge_count}
                      is_active={workflow.is_active}
                      isTemplate={false}
                      isAdmin={true}
                      onDelete={() => handleDeleteWorkflow(workflow.id)}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleLoadMore}
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
                          Load More ({allWorkflows.length} of {total})
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminWorkflowsView;

