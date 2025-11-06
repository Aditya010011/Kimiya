import React, { useState } from 'react';
import { X, Database, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CreateKnowledgeBaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description: string; chunkSize?: number; chunkOverlap?: number; embeddingModel?: string }) => Promise<void>;
}

const CreateKnowledgeBaseModal: React.FC<CreateKnowledgeBaseModalProps> = ({
  open,
  onClose,
  onCreate
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chunkSize, setChunkSize] = useState('1000');
  const [chunkOverlap, setChunkOverlap] = useState('200');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-004');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        chunkSize: parseInt(chunkSize),
        chunkOverlap: parseInt(chunkOverlap),
        embeddingModel
      });
      
      // Reset form
      setName('');
      setDescription('');
      setChunkSize('1000');
      setChunkOverlap('200');
      setEmbeddingModel('text-embedding-004');
      setShowAdvanced(false);
    } catch (error) {
      console.error('Error creating knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setDescription('');
      setChunkSize('1000');
      setChunkOverlap('200');
      setEmbeddingModel('text-embedding-004');
      setShowAdvanced(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Create Knowledge Base</DialogTitle>
              <DialogDescription>
                Set up a new knowledge base for RAG-powered conversations
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Product Documentation, Customer Support KB"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what this knowledge base contains..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Advanced Settings
              </span>
              <span className="text-xs text-gray-500">
                {showAdvanced ? 'Hide' : 'Show'}
              </span>
            </Button>

            {showAdvanced && (
              <Card className="border-dashed">
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="embeddingModel" className="text-sm font-medium">
                      Embedding Model
                    </Label>
                    <Select value={embeddingModel} onValueChange={setEmbeddingModel} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Google AI Studio Models */}
                        <SelectItem value="text-embedding-004">
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">text-embedding-004</span>
                              <Badge variant="default" className="ml-2">Recommended</Badge>
                            </div>
                            <span className="text-xs text-gray-500">Google AI • 768 dims • Latest & most stable</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="text-embedding-003">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">text-embedding-003</span>
                            <span className="text-xs text-gray-500">Google AI • 768 dims • Previous version</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="embedding-001">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">embedding-001</span>
                            <span className="text-xs text-gray-500">Google AI • 768 dims • Legacy model</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Google AI Studio embedding model for semantic search
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chunkSize" className="text-sm font-medium">
                        Chunk Size (tokens)
                      </Label>
                      <Input
                        id="chunkSize"
                        type="number"
                        min="100"
                        max="2000"
                        step="100"
                        value={chunkSize}
                        onChange={(e) => setChunkSize(e.target.value)}
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500">
                        Default: 1000 tokens
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chunkOverlap" className="text-sm font-medium">
                        Chunk Overlap (tokens)
                      </Label>
                      <Input
                        id="chunkOverlap"
                        type="number"
                        min="0"
                        max="500"
                        step="50"
                        value={chunkOverlap}
                        onChange={(e) => setChunkOverlap(e.target.value)}
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500">
                        Default: 200 tokens
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-900">
                      <p className="font-medium mb-1">Chunking Strategy</p>
                      <p>
                        Documents are split into smaller chunks for better retrieval. 
                        Overlap ensures context continuity between chunks.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info Card */}
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <div className="text-sm text-purple-900">
                  <p className="font-medium mb-1">What's a Knowledge Base?</p>
                  <p className="text-purple-700">
                    A knowledge base stores your documents and data, enabling AI agents to 
                    retrieve relevant information during conversations using RAG (Retrieval-Augmented Generation).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Create Knowledge Base
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateKnowledgeBaseModal;

