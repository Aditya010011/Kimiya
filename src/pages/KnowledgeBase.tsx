import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Database,
  FileText,
  Upload,
  Trash2,
  Edit,
  MoreVertical,
  Eye,
  Settings,
  Download,
  RefreshCw,
  Filter,
  SortAsc,
  BookOpen,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import CreateKnowledgeBaseModal from '@/components/knowledge-base/CreateKnowledgeBaseModal';
import KnowledgeBaseDetailModal from '@/components/knowledge-base/KnowledgeBaseDetailModal';
import { knowledgeBaseService } from '@/services/knowledgeBaseService';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  total_chunks: number;
  embedding_model: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const KnowledgeBase: React.FC = () => {
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [filteredKBs, setFilteredKBs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'documents'>('created');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  useEffect(() => {
    filterAndSortKBs();
  }, [knowledgeBases, searchQuery, sortBy, filterStatus]);

  const loadKnowledgeBases = async () => {
    try {
      setLoading(true);
      const data = await knowledgeBaseService.list();
      setKnowledgeBases(data.knowledgeBases || []);
    } catch (error: any) {
      console.error('Error loading knowledge bases:', error);
      toast.error(error.message || 'Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortKBs = () => {
    let filtered = [...knowledgeBases];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(kb =>
        kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(kb =>
        filterStatus === 'active' ? kb.is_active : !kb.is_active
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'documents':
          return (b.document_count || 0) - (a.document_count || 0);
        case 'created':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredKBs(filtered);
  };

  const handleCreateKB = async (data: { name: string; description: string }) => {
    try {
      await knowledgeBaseService.create(data);
      toast.success('Knowledge base created successfully');
      setShowCreateModal(false);
      loadKnowledgeBases();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create knowledge base');
    }
  };

  const handleDeleteKB = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge base? This action cannot be undone.')) {
      return;
    }

    try {
      await knowledgeBaseService.delete(id);
      toast.success('Knowledge base deleted successfully');
      loadKnowledgeBases();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete knowledge base');
    }
  };

  const handleViewKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setShowDetailModal(true);
  };

  const getStatusBadge = (kb: KnowledgeBase) => {
    if (!kb.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (kb.document_count === 0) {
      return <Badge variant="outline">Empty</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Knowledge Base"
        subtitle="Manage your AI knowledge bases and documents"
        showNewWorkflowButton={false}
      />

      <div className="container mx-auto px-6 py-8">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Bases</h1>
              <p className="text-sm text-gray-600">
                {knowledgeBases.length} {knowledgeBases.length === 1 ? 'base' : 'bases'} • {' '}
                {knowledgeBases.reduce((sum, kb) => sum + (kb.document_count || 0), 0)} documents
              </p>
            </div>
          </div>

          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Knowledge Base
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search knowledge bases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SortAsc className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Recently Created</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="documents">Most Documents</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={loadKnowledgeBases} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Bases Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredKBs.length === 0 ? (
          <Card className="py-20">
            <CardContent className="text-center">
              <Database className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || filterStatus !== 'all' ? 'No knowledge bases found' : 'No knowledge bases yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first knowledge base to get started with RAG-powered conversations'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Knowledge Base
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredKBs.map((kb) => (
              <KnowledgeBaseCard
                key={kb.id}
                knowledgeBase={kb}
                onView={() => handleViewKB(kb)}
                onDelete={() => handleDeleteKB(kb.id)}
                getStatusBadge={getStatusBadge}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateKnowledgeBaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateKB}
      />

      {selectedKB && (
        <KnowledgeBaseDetailModal
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedKB(null);
          }}
          knowledgeBase={selectedKB}
          onUpdate={loadKnowledgeBases}
        />
      )}
    </div>
  );
};

// Knowledge Base Card Component
interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase;
  onView: () => void;
  onDelete: () => void;
  getStatusBadge: (kb: KnowledgeBase) => React.ReactNode;
  formatDate: (date: string) => string;
}

const KnowledgeBaseCard: React.FC<KnowledgeBaseCardProps> = ({
  knowledgeBase,
  onView,
  onDelete,
  getStatusBadge,
  formatDate
}) => {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={onView}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1 group-hover:text-indigo-600 transition-colors">
              {knowledgeBase.name}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {knowledgeBase.description || 'No description'}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status</span>
            {getStatusBadge(knowledgeBase)}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Documents</span>
            <span className="font-medium">{knowledgeBase.document_count || 0}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Chunks</span>
            <span className="font-medium">{knowledgeBase.total_chunks || 0}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Model</span>
            <Badge variant="outline" className="text-xs">
              {knowledgeBase.embedding_model || 'ada-002'}
            </Badge>
          </div>
        </div>
      </CardContent>

      <CardFooter className="text-xs text-gray-500 border-t pt-4">
        <Clock className="h-3 w-3 mr-1" />
        Created {formatDate(knowledgeBase.created_at)}
      </CardFooter>
    </Card>
  );
};

export default KnowledgeBase;

