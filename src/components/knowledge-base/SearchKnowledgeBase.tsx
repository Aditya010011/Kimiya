import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { knowledgeBaseService } from '@/services/knowledgeBaseService';

interface SearchKnowledgeBaseProps {
  knowledgeBaseId: string;
}

interface SearchResult {
  id: string;
  text: string;
  score: number;
  documentId: string;
  chunkIndex: number;
  metadata?: any;
}

interface RAGResponse {
  answer: string;
  sources: Array<{
    text: string;
    score: number;
    documentId: string;
    chunkIndex: number;
  }>;
  confidence: number;
  chunksUsed: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const SearchKnowledgeBase: React.FC<SearchKnowledgeBaseProps> = ({
  knowledgeBaseId
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'rag'>('search');

  // Token usage tracking for RAG queries
  const [sessionTokenUsage, setSessionTokenUsage] = useState({
    total_prompt_tokens: 0,
    total_completion_tokens: 0,
    total_tokens: 0,
    query_count: 0
  });

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setLoading(true);
      setSearchResults([]);
      setRagResponse(null);

      if (searchMode === 'search') {
        // Vector search only
        const data = await knowledgeBaseService.search(knowledgeBaseId, query, 5);
        setSearchResults(data.results || []);
        toast.success(`Found ${data.results?.length || 0} results in ${data.responseTime}ms`);
      } else {
        // RAG query (search + AI response)
        const data = await knowledgeBaseService.query(knowledgeBaseId, query);
        setRagResponse(data);

        // Update session token usage
        if (data.usage) {
          setSessionTokenUsage(prev => ({
            total_prompt_tokens: prev.total_prompt_tokens + (data.usage?.prompt_tokens || 0),
            total_completion_tokens: prev.total_completion_tokens + (data.usage?.completion_tokens || 0),
            total_tokens: prev.total_tokens + (data.usage?.total_tokens || 0),
            query_count: prev.query_count + 1
          }));
        }

        toast.success('Response generated successfully');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-6">
      {/* Session Token Usage Banner */}
      {searchMode === 'rag' && sessionTokenUsage.query_count > 0 && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Session Token Usage</span>
              <Badge variant="secondary">{sessionTokenUsage.query_count} {sessionTokenUsage.query_count === 1 ? 'query' : 'queries'}</Badge>
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

      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Test Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selector */}
          <Tabs value={searchMode} onValueChange={(value: any) => setSearchMode(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="gap-2">
                <Search className="h-4 w-4" />
                Vector Search
              </TabsTrigger>
              <TabsTrigger value="rag" className="gap-2">
                <Sparkles className="h-4 w-4" />
                RAG Query
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Query Input */}
          <div className="space-y-2">
            <Textarea
              placeholder={
                searchMode === 'search'
                  ? 'Enter your search query to find relevant chunks...'
                  : 'Ask a question to get an AI-generated response with sources...'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {searchMode === 'search'
                  ? 'Returns top 5 most relevant document chunks'
                  : 'Generates AI response using retrieved context'}
              </p>
              <Button onClick={handleSearch} disabled={loading || !query.trim()} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    {searchMode === 'search' ? (
                      <Search className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {searchMode === 'search' ? 'Search' : 'Generate'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vector Search Results */}
      {searchMode === 'search' && searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Search Results ({searchResults.length})</span>
              <Badge variant="secondary">{searchResults.length} chunks found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {searchResults.map((result, index) => (
              <div
                key={result.id || `result-${index}`}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      #{index + 1}
                    </Badge>
                    <Badge className={getScoreColor(result.score)}>
                      {(result.score * 100).toFixed(1)}% match
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(result.text)}
                    className="h-8 w-8 p-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {result.text}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Document: {result.documentId.substring(0, 8)}...</span>
                  <span>Chunk: {result.chunkIndex}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* RAG Response */}
      {searchMode === 'rag' && ragResponse && (
        <div className="space-y-4">
          {/* AI Response */}
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                AI Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-white rounded-lg border border-indigo-200">
                  <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {ragResponse.answer}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(ragResponse.answer)}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Response
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Badge variant="secondary">
                        Confidence: {(ragResponse.confidence * 100).toFixed(1)}%
                      </Badge>
                      <Badge variant="outline">
                        {ragResponse.chunksUsed} chunks used
                      </Badge>
                    </div>
                  </div>

                  {/* Token Usage Display */}
                  {ragResponse.usage && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
                      <span className="font-semibold" title={`Prompt: ${ragResponse.usage.prompt_tokens} | Completion: ${ragResponse.usage.completion_tokens}`}>
                        🪙 {ragResponse.usage.total_tokens} tokens
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Sources
                </span>
                <Badge variant="secondary">{ragResponse.sources.length} sources</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ragResponse.sources.map((source, index) => (
                <div
                  key={`${source.documentId}-${source.chunkIndex || index}`}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono">
                      Source #{index + 1}
                    </Badge>
                    <Badge className={getScoreColor(source.score)}>
                      {(source.score * 100).toFixed(1)}% relevance
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {source.text}
                  </p>
                  <p className="text-xs text-gray-500">
                    Document: {source.documentId.substring(0, 8)}...
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!loading && searchResults.length === 0 && !ragResponse && query && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              Try a different query or upload more documents to your knowledge base
            </p>
          </CardContent>
        </Card>
      )}

      {/* Example Queries */}
      {!query && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Example Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                'What are the main features of the product?',
                'How do I reset my password?',
                'What is the refund policy?',
                'Tell me about pricing plans'
              ].map((example, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(example)}
                  className="w-full text-left p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all text-sm text-gray-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchKnowledgeBase;

