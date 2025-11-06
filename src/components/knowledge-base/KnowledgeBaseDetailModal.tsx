import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Trash2,
  Download,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  File,
  FileType,
  Database,
  Sparkles,
  Eye,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { knowledgeBaseService } from '@/services/knowledgeBaseService';
import DocumentUploadArea from './DocumentUploadArea';
import SearchKnowledgeBase from './SearchKnowledgeBase';

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

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface KnowledgeBaseDetailModalProps {
  open: boolean;
  onClose: () => void;
  knowledgeBase: KnowledgeBase;
  onUpdate: () => void;
}

const KnowledgeBaseDetailModal: React.FC<KnowledgeBaseDetailModalProps> = ({
  open,
  onClose,
  knowledgeBase,
  onUpdate
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');

  useEffect(() => {
    if (open) {
      loadDocuments();
    }
  }, [open, knowledgeBase.id]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await knowledgeBaseService.getDocuments(knowledgeBase.id);
      setDocuments(data.documents || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    loadDocuments();
    onUpdate();
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await knowledgeBaseService.deleteDocument(knowledgeBase.id, documentId);
      toast.success('Document deleted successfully');
      loadDocuments();
      onUpdate();
    } catch (error: any) {
      toast.error('Failed to delete document');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="default" className="bg-blue-500 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return <FileType className="h-4 w-4 text-red-500" />;
    if (type.includes('doc')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (type.includes('txt')) return <File className="h-4 w-4 text-gray-500" />;
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">{knowledgeBase.name}</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {knowledgeBase.description || 'No description'}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <div className="text-2xl font-bold">{knowledgeBase.document_count || 0}</div>
                  <div className="text-xs text-gray-600">Documents</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Database className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <div className="text-2xl font-bold">{knowledgeBase.total_chunks || 0}</div>
                  <div className="text-xs text-gray-600">Chunks</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 mx-auto text-indigo-600 mb-2" />
                  <div className="text-sm font-medium">{knowledgeBase.embedding_model}</div>
                  <div className="text-xs text-gray-600">Model</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search & Test
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="documents" className="mt-0 h-full">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadDocuments}
                    disabled={loading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
                      <p className="text-gray-600 mb-4">Upload documents to start building your knowledge base</p>
                      <Button onClick={() => setActiveTab('upload')} className="gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Documents
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Chunks</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {documents.map((doc) => (
                            <TableRow key={doc.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getFileIcon(doc.file_type)}
                                  <span className="font-medium">{doc.filename}</span>
                                </div>
                              </TableCell>
                              <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                              <TableCell>{doc.chunk_count || 0}</TableCell>
                              <TableCell>{getStatusBadge(doc.processing_status)}</TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {formatDate(doc.created_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload" className="mt-0 h-full">
              <DocumentUploadArea
                knowledgeBaseId={knowledgeBase.id}
                onUploadComplete={handleUploadComplete}
              />
            </TabsContent>

            <TabsContent value="search" className="mt-0 h-full">
              <SearchKnowledgeBase knowledgeBaseId={knowledgeBase.id} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgeBaseDetailModal;

